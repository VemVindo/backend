#!/usr/bin/env node
// Relatorio do CI. Sem dependencias: so le os JSON gerados pelos testes.
// O arquivo e igual no backend e no frontend; mude nos dois.
//
//   cobertura  compara a cobertura atual com a da main e falha se as linhas
//              cairem mais que --max-queda pontos percentuais.
//   resumo     monta o markdown do resumo da execucao e do comentario do PR.
//
// Arquivo ausente nao e erro: a secao aparece como "nao executado".

import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

const METRICAS = [
  ['lines', 'Linhas'],
  ['statements', 'Statements'],
  ['branches', 'Branches'],
  ['functions', 'Funções'],
];

const ETAPAS = {
  'titulo-pr': 'Título do PR',
  lint: 'Lint',
  typecheck: 'Typecheck',
  testes: 'Testes unitários',
  e2e: 'Testes e2e',
  migrations: 'Migrations',
  seguranca: 'Segurança',
  imagem: 'Imagem Docker',
};

const ICONE_RESULTADO = {
  success: 'OK',
  failure: 'FALHOU',
  cancelled: 'cancelado',
  skipped: 'pulado',
};

function lerJson(caminho) {
  if (!caminho || !existsSync(caminho)) return null;
  return JSON.parse(readFileSync(caminho, 'utf8'));
}

function pct(valor) {
  return `${valor.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function delta(atual, base) {
  if (base === undefined) return '';
  const diferenca = Math.round((atual - base) * 10) / 10;
  if (diferenca === 0) return ' (=)';
  const sinal = diferenca > 0 ? '+' : '';
  return ` (${sinal}${diferenca.toLocaleString('pt-BR', { maximumFractionDigits: 1 })})`;
}

function secaoTestes(resultado, titulo) {
  if (!resultado) return `### ${titulo}: não executado\n`;
  const total = resultado.numTotalTests;
  const passaram = resultado.numPassedTests;
  const falharam = resultado.numFailedTests;
  const ignorados = (resultado.numPendingTests ?? 0) + (resultado.numTodoTests ?? 0);
  const fins = resultado.testResults.map((r) => r.perfStats?.end ?? r.endTime ?? 0);
  const segundos = fins.length ? (Math.max(...fins) - resultado.startTime) / 1000 : 0;
  const taxa = total ? (passaram / total) * 100 : 0;

  const falhas = resultado.testResults
    .flatMap((r) => r.assertionResults ?? [])
    .filter((a) => a.status === 'failed')
    .map((a) => `- ${a.fullName ?? a.title}`);

  let md = `### ${titulo}: ${passaram}/${total} passando (${pct(taxa)})\n\n`;
  md += '| Total | Passaram | Falharam | Ignorados | Duração |\n|---|---|---|---|---|\n';
  md += `| ${total} | ${passaram} | ${falharam} | ${ignorados} | ${segundos.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} s |\n`;
  if (falhas.length) {
    md += `\n<details><summary>${falhas.length} teste(s) falhando</summary>\n\n${falhas.slice(0, 20).join('\n')}\n</details>\n`;
  }
  return md;
}

function secaoCobertura(atual, base) {
  if (!atual) return '### Cobertura: não executada\n';
  const titulo = base ? 'Cobertura (variação em relação à main)' : 'Cobertura (sem baseline da main)';
  let md = `### ${titulo}\n\n| ${METRICAS.map(([, rotulo]) => rotulo).join(' | ')} |\n|${'---|'.repeat(METRICAS.length)}\n`;
  md += `| ${METRICAS.map(([chave]) => pct(atual.total[chave].pct) + delta(atual.total[chave].pct, base?.total[chave].pct)).join(' | ')} |\n`;
  return md;
}

function secaoApi(newman) {
  if (!newman) return '';
  const { requests, assertions } = newman.run.stats;
  const falhas = newman.run.failures.map((f) => `- ${f.source?.name ?? 'requisição'}: ${f.error?.message ?? f.error?.test}`);
  let md = `### API (Postman): ${requests.total} requisições, ${assertions.total - assertions.failed}/${assertions.total} asserções passando\n`;
  if (falhas.length) {
    md += `\n<details><summary>${falhas.length} falha(s)</summary>\n\n${falhas.slice(0, 20).join('\n')}\n</details>\n`;
  }
  return md;
}

function secaoEtapas(needs) {
  if (!needs) return '';
  const linhas = Object.entries(needs)
    .filter(([job]) => ETAPAS[job])
    .map(([job, { result }]) => `| ${ETAPAS[job]} | ${ICONE_RESULTADO[result] ?? result} |`);
  return `### Etapas\n\n| Etapa | Resultado |\n|---|---|\n${linhas.join('\n')}\n`;
}

function cobertura(opcoes) {
  const atual = lerJson(opcoes.atual);
  const base = lerJson(opcoes.base);
  if (!atual) {
    console.error(`Cobertura atual não encontrada em ${opcoes.atual}`);
    process.exit(1);
  }
  if (!base) {
    console.log('::warning::Sem cobertura da main para comparar; só o mínimo absoluto foi conferido.');
    return;
  }
  const queda = base.total.lines.pct - atual.total.lines.pct;
  const limite = Number(opcoes['max-queda']);
  console.log(`Linhas: main ${pct(base.total.lines.pct)}, PR ${pct(atual.total.lines.pct)}`);
  if (queda > limite) {
    console.log(`::error::A cobertura de linhas caiu ${queda.toFixed(2)} pontos percentuais (limite: ${limite}).`);
    process.exit(1);
  }
}

function resumo(opcoes) {
  const partes = [
    `## CI ${opcoes.projeto}`,
    secaoEtapas(opcoes.etapas ? JSON.parse(opcoes.etapas) : null),
    secaoTestes(lerJson(opcoes.testes), 'Testes unitários'),
    secaoCobertura(lerJson(opcoes.cobertura), lerJson(opcoes.base)),
    secaoApi(lerJson(opcoes.api)),
  ].filter(Boolean);
  const markdown = `${partes.join('\n')}\n`;

  if (opcoes.saida) writeFileSync(opcoes.saida, markdown);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
  console.log(markdown);
}

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    atual: { type: 'string' },
    base: { type: 'string' },
    'max-queda': { type: 'string', default: '1' },
    projeto: { type: 'string', default: '' },
    testes: { type: 'string' },
    cobertura: { type: 'string' },
    api: { type: 'string' },
    etapas: { type: 'string' },
    saida: { type: 'string' },
  },
});

const comandos = { cobertura, resumo };
const comando = comandos[positionals[0]];
if (!comando) {
  console.error('Uso: relatorio.mjs <cobertura|resumo> [opções]');
  process.exit(2);
}
comando(values);
