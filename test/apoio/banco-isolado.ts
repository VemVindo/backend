import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';
import { StatusPedido } from '../../src/generated/prisma/enums';
import type { PrismaService } from '../../src/prisma/prisma.service';

const TEMPO_LIMITE_CONEXAO_MS = 5_000;
const URL_DO_BANCO = process.env.TEST_DATABASE_URL;
const PASTA_DAS_MIGRACOES = join(__dirname, '../../prisma/migrations');

export const TEMPO_LIMITE_PREPARACAO_MS = 60_000;
export const descreverComBanco = URL_DO_BANCO ? describe : describe.skip;

export interface BancoIsolado {
  prisma: PrismaService;
  encerrar: () => Promise<void>;
}

export async function criarBancoIsolado(
  prefixo: string,
): Promise<BancoIsolado> {
  const esquema = `${prefixo}_${randomUUID().replaceAll('-', '')}`;
  const opcoes = {
    connectionString: URL_DO_BANCO,
    connectionTimeoutMillis: TEMPO_LIMITE_CONEXAO_MS,
  };
  const administracao = new Pool(opcoes);
  await administracao.query(`CREATE SCHEMA "${esquema}"`);
  await aplicarMigracoes(esquema, opcoes);
  const cliente = new PrismaClient({
    adapter: new PrismaPg(
      { connectionString: URL_DO_BANCO, options: `-c search_path=${esquema}` },
      { schema: esquema },
    ),
  });

  return {
    prisma: cliente as unknown as PrismaService,
    encerrar: async () => {
      await cliente.$disconnect();
      await administracao.query(`DROP SCHEMA IF EXISTS "${esquema}" CASCADE`);
      await administracao.end();
    },
  };
}

async function aplicarMigracoes(
  esquema: string,
  opcoes: { connectionString?: string; connectionTimeoutMillis: number },
) {
  const conexao = new Pool({ ...opcoes, options: `-c search_path=${esquema}` });
  const migracoes = readdirSync(PASTA_DAS_MIGRACOES)
    .filter((nome) => /^\d/.test(nome))
    .sort();
  for (const migracao of migracoes) {
    await conexao.query(
      readFileSync(
        join(PASTA_DAS_MIGRACOES, migracao, 'migration.sql'),
        'utf8',
      ),
    );
  }
  await conexao.end();
}

export async function cadastrarEmpresa(
  prisma: PrismaService,
  apelido: string,
): Promise<number> {
  const empresa = await prisma.empresa.create({
    data: {
      nome_fantasia: `Empresa ${apelido}`,
      email: `${apelido}@integracao.test`,
      telefone: '61900000000',
      cep: '70000000',
      logradouro: 'Rua de Teste',
      numero: 1,
      bairro: 'Centro',
      cidade: 'Brasilia',
      UF: 'DF',
      senha: 'hash-que-nao-e-usado',
    },
  });
  return empresa.id_empresa;
}

export async function cadastrarPedido(
  prisma: PrismaService,
  idEmpresa: number,
): Promise<number> {
  const pedido = await prisma.pedido.create({
    data: {
      nome_recebedor: 'Recebedor de Teste',
      telefone_recebedor: '61920000000',
      cep: '70000000',
      logradouro: 'Rua de Teste',
      numero: 1,
      bairro: 'Centro',
      cidade: 'Brasilia',
      uf: 'DF',
      descricao: 'Pedido de teste',
      status: StatusPedido.PENDENTE,
      data_criacao: new Date(),
      valor_entrega: 800,
      distancia: 0,
      idEmpresa,
    },
  });
  return pedido.id_pedido;
}
