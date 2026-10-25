import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import {
  CANTINA,
  PADARIA,
  Sessao,
  entrarComoEmpresa,
  identificadorUnico,
  semLogin,
  subirAplicacao,
} from './apoio/aplicacao';

interface CredencialGerada {
  chave: string;
}

interface ResultadoDaImportacao {
  resumo: Record<string, number>;
  resultados: {
    idExterno: string | null;
    situacao: string;
    idPedido?: number;
    idPendencia?: number;
    camposFaltantes?: string[];
  }[];
}

interface PedidoDaLista {
  id: number;
  recebedor: string;
  status: string;
}

interface Pendencia {
  id: number;
}

const CABECALHO_DA_CHAVE = 'X-Api-Key';

function pedidoExterno(idExterno: string, nomeRecebedor: string) {
  return {
    idExterno,
    nomeRecebedor,
    telefoneRecebedor: '61920000009',
    cep: '70297400',
    logradouro: 'SQS 308 Bloco C',
    numero: 101,
    bairro: 'Asa Sul',
    cidade: 'Brasilia',
    uf: 'DF',
    descricao: 'Pedido importado no teste',
  };
}

async function gerarChave(empresa: Sessao): Promise<string> {
  const body: unknown = (
    await empresa.get('/integracao/credencial').expect(200)
  ).body;
  const jaTemCredencial = (body as { credencial: unknown }).credencial !== null;
  const resposta = jaTemCredencial
    ? await empresa.post('/integracao/credencial/rotacionar').expect(200)
    : await empresa.post('/integracao/credencial').expect(201);
  return (resposta.body as CredencialGerada).chave;
}

describe('E-US12 integracao com outros sistemas (e2e)', () => {
  let aplicacao: INestApplication<App>;
  let padaria: Sessao;
  let chave: string;
  let importacao: ResultadoDaImportacao;
  const nomeDoRecebedor = identificadorUnico('Recebedor Importado');
  const idCompleto = identificadorUnico('PED');
  const idIncompleto = identificadorUnico('PED');

  function importar(pedidos: unknown[], chaveUsada = chave) {
    return semLogin(aplicacao)
      .post('/integracao/pedidos')
      .set(CABECALHO_DA_CHAVE, chaveUsada)
      .send({ pedidos });
  }

  beforeAll(async () => {
    aplicacao = await subirAplicacao();
    padaria = await entrarComoEmpresa(aplicacao, PADARIA.email);
    chave = await gerarChave(padaria);
  });

  afterAll(async () => {
    await aplicacao.close();
  });

  it.each([
    ['sem chave', undefined, 'ausente'],
    ['com chave inventada', 'vv_000000000000_chave-que-nao-existe', 'invalida'],
  ])('recusa a importacao %s', async (_caso, chaveEnviada, motivo) => {
    const requisicao = semLogin(aplicacao).post('/integracao/pedidos');
    const body: unknown = (
      await (
        chaveEnviada
          ? requisicao.set(CABECALHO_DA_CHAVE, chaveEnviada)
          : requisicao
      )
        .send({ pedidos: [pedidoExterno(idCompleto, nomeDoRecebedor)] })
        .expect(401)
    ).body;

    expect(JSON.stringify(body)).toContain(motivo);
  });

  it('o cookie da empresa nao substitui a chave', async () => {
    await padaria
      .post('/integracao/pedidos')
      .send({ pedidos: [pedidoExterno(idCompleto, nomeDoRecebedor)] })
      .expect(401);
  });

  it('separa cada pedido do lote pela situacao', async () => {
    importacao = (
      await importar([
        { ...pedidoExterno(idCompleto, nomeDoRecebedor), idEmpresa: 1 },
        pedidoExterno(idCompleto, nomeDoRecebedor),
        { ...pedidoExterno(idIncompleto, nomeDoRecebedor), cep: undefined },
        'isto nao e um pedido',
      ]).expect(200)
    ).body as ResultadoDaImportacao;

    expect(importacao.resultados.map((item) => item.situacao)).toEqual([
      'importado',
      'duplicado',
      'incompleto',
      'invalido',
    ]);
    expect(importacao.resultados[2].camposFaltantes).toEqual(['cep']);
    expect(importacao.resumo).toMatchObject({
      recebidos: 4,
      importados: 1,
      duplicados: 1,
      incompletos: 1,
      invalidos: 1,
    });
  });

  it('cria o pedido pendente na empresa dona da chave, nunca na do corpo', async () => {
    const pedidosDaPadaria = (await padaria.get('/pedidos').expect(200))
      .body as PedidoDaLista[];
    const cantina = await entrarComoEmpresa(aplicacao, CANTINA.email);
    const pedidosDaCantina = (await cantina.get('/pedidos').expect(200))
      .body as PedidoDaLista[];

    expect(
      pedidosDaPadaria.find((pedido) => pedido.recebedor === nomeDoRecebedor),
    ).toMatchObject({
      id: importacao.resultados[0].idPedido,
      status: 'PENDENTE',
    });
    expect(pedidosDaCantina.map((pedido) => pedido.recebedor)).not.toContain(
      nomeDoRecebedor,
    );
  });

  it('a empresa completa a pendencia e o pedido e criado', async () => {
    const idPendencia = importacao.resultados[2].idPendencia;
    const pendencias = (await padaria.get('/integracao/pendencias').expect(200))
      .body as Pendencia[];

    expect(pendencias.map((pendencia) => pendencia.id)).toContain(idPendencia);
    const body: unknown = (
      await padaria
        .post(`/integracao/pendencias/${idPendencia}/completar`)
        .send({ cep: '70297400' })
        .expect(200)
    ).body;
    expect(typeof (body as { idPedido: unknown }).idPedido).toBe('number');
  });

  it('rotacionar a chave derruba a anterior na hora', async () => {
    const chaveAntiga = chave;
    chave = (
      (await padaria.post('/integracao/credencial/rotacionar').expect(200))
        .body as CredencialGerada
    ).chave;

    await importar(
      [pedidoExterno(identificadorUnico('PED'), nomeDoRecebedor)],
      chaveAntiga,
    ).expect(401);
    await importar([
      pedidoExterno(identificadorUnico('PED'), nomeDoRecebedor),
    ]).expect(200);
  });
});
