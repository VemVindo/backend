import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  CANTINA,
  PADARIA,
  Sessao,
  entrarComoEmpresa,
  entrarComoEntregador,
  gerarCpfValido,
  subirAplicacao,
} from './apoio/aplicacao';

interface PedidoResumo {
  id: number;
  status: string;
  entregador: string | null;
  distanciaConhecida: boolean | null;
  ganhoConsolidadoCentavos: number | null;
}

interface AvaliacaoNaLista {
  idPedido: number;
  nota: number;
  comentario: string | null;
}

// Percorre a entrega inteira pelas rotas HTTP, na ordem em que acontece:
// cadastro, atribuicao, link de rastreio, finalizacao com codigo e avaliacao.
const NOME_DO_ENTREGADOR = 'Fausto Teste';

// Cadastra um entregador na Cantina e passa pelo primeiro acesso e pelo aceite
// do convite. Os entregadores do seed podem estar ocupados por outros arquivos.
async function cadastrarEntregadorPronto(
  app: INestApplication<App>,
  cantina: Sessao,
): Promise<{ cpf: string; sessao: Sessao }> {
  const cpf = gerarCpfValido();
  const { senhaTemporaria } = (
    await cantina
      .post('/entregadores')
      .send({
        nome: NOME_DO_ENTREGADOR,
        cpf,
        telefone: '61988886666',
        tipoVeiculo: 'MOTO',
        placa: 'FLX1E23',
      })
      .expect(201)
  ).body as { senhaTemporaria: string };

  const sessao = await entrarComoEntregador(app, cpf, senhaTemporaria);
  await sessao
    .post('/auth/entregador/trocar-senha')
    .send({
      senhaAtual: senhaTemporaria,
      novaSenha: 'SenhaDoFluxo@2026',
      cienteDadosCompartilhados: true,
    })
    .expect(200);
  const [convite] = (await sessao.get('/entregador/vinculos').expect(200))
    .body as { id: number }[];
  await sessao
    .post(`/entregador/vinculos/${convite.id}/aceitar`)
    .expect((resposta) => {
      expect(resposta.status).toBeLessThan(300);
    });
  return { cpf, sessao };
}

// Cria o proprio pedido e o proprio entregador, entao pode rodar de novo sobre
// o mesmo seed e em qualquer ordem com os outros arquivos.
describe('Fluxo da entrega (e2e)', () => {
  let app: INestApplication<App>;
  let cantina: Sessao;
  let padaria: Sessao;
  let entregador: Sessao;
  let cpfEntregador: string;
  let idPedido: number;
  let token: string;
  let codigoRecebedor: string;

  // Sobe a aplicacao e encadeia varios hashes bcrypt de custo 12 (logins,
  // cadastro e troca de senha), o que passa dos 5 s padrao em maquina carregada.
  beforeAll(async () => {
    app = await subirAplicacao();
    cantina = await entrarComoEmpresa(app, CANTINA.email);
    padaria = await entrarComoEmpresa(app, PADARIA.email);
    ({ cpf: cpfEntregador, sessao: entregador } =
      await cadastrarEntregadorPronto(app, cantina));
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it('cadastra o pedido como pendente', async () => {
    const resposta = await cantina
      .post('/pedidos')
      .send({
        nome_recebedor: 'Teste Ponta a Ponta',
        telefone_recebedor: '61920009999',
        cep: '70000000',
        logradouro: 'Rua de Teste',
        numero: 1,
        bairro: 'Centro',
        cidade: 'Brasilia',
        uf: 'DF',
        descricao: 'Pedido do teste e2e',
        tipo_veiculo: 'DRIVE',
      })
      .expect(201);

    expect(resposta.body).toMatchObject({ status: 'PENDENTE' });
    idPedido = (resposta.body as { id_pedido: number }).id_pedido;
  });

  it('recusa pedido com campo obrigatorio faltando', () => {
    return cantina.post('/pedidos').send({ descricao: 'sem nada' }).expect(400);
  });

  it('esconde o pedido de outra empresa', () => {
    return padaria.get(`/pedidos/${idPedido}`).expect(404);
  });

  it('atribui ao entregador e coloca a entrega em andamento', async () => {
    const resposta = await cantina
      .patch(`/pedidos/${idPedido}/atribuir`)
      .send({ cpfEntregador })
      .expect(200);

    expect(resposta.body).toMatchObject({
      id: idPedido,
      status: 'EM_ANDAMENTO',
      entregador: NOME_DO_ENTREGADOR,
    });
  });

  it('nao atribui de novo um pedido que ja tem entregador', () => {
    return cantina
      .patch(`/pedidos/${idPedido}/atribuir`)
      .send({ cpfEntregador })
      .expect(409);
  });

  it('corrige a distancia antes da conclusao', async () => {
    const resposta = await cantina
      .patch(`/pedidos/${idPedido}/distancia`)
      .send({ distanciaMetros: 2000 })
      .expect(200);

    expect((resposta.body as PedidoResumo).distanciaConhecida).toBe(true);
  });

  it('mostra a entrega na lista do entregador', async () => {
    const resposta = await entregador
      .get('/pedidos/minhas-entregas')
      .expect(200);

    const ids = (resposta.body as { id: number }[]).map((p) => p.id);
    expect(ids).toContain(idPedido);
  });

  it('so oferece a finalizacao com codigo', async () => {
    const resposta = await entregador
      .get(`/pedidos/${idPedido}/status-disponiveis`)
      .expect(200);

    expect(resposta.body).toEqual({
      statusAtual: 'EM_ANDAMENTO',
      statusDisponiveis: [],
      podeFinalizarComCodigo: true,
    });
  });

  it('nao finaliza antes de o recebedor ter o codigo', () => {
    return entregador
      .post(`/pedidos/${idPedido}/finalizar`)
      .send({ codigo: '123456' })
      .expect(409);
  });

  it('gera o link de rastreio com o codigo do recebedor', async () => {
    const resposta = await cantina
      .post(`/pedidos/${idPedido}/link-rastreio`)
      .expect(200);

    const corpo = resposta.body as { link: string; codigoRecebedor: string };
    expect(corpo.codigoRecebedor).toMatch(/^\d{6}$/);
    token = corpo.link.split('/rastreio/')[1];
    codigoRecebedor = corpo.codigoRecebedor;
    expect(token).toBeTruthy();
  });

  it('abre o rastreio pelo link, sem login', async () => {
    const resposta = await request(app.getHttpServer())
      .get(`/rastreio/${token}`)
      .expect(200);

    expect(resposta.body).toMatchObject({
      estabelecimento: 'Cantina Dona Marta',
      entregador: 'Fausto',
      pedido: { numero: idPedido, status: 'EM_ANDAMENTO' },
    });
  });

  it('recusa link de rastreio inventado', () => {
    return request(app.getHttpServer())
      .get('/rastreio/link-que-nao-existe')
      .expect(404);
  });

  it('recusa o codigo errado e conta a tentativa', async () => {
    const errado = codigoRecebedor === '000000' ? '111111' : '000000';

    const resposta = await entregador
      .post(`/pedidos/${idPedido}/finalizar`)
      .send({ codigo: errado })
      .expect(422);

    expect(resposta.body).toMatchObject({ tentativasRestantes: 4 });
  });

  it('finaliza com o codigo certo e consolida o ganho', async () => {
    const resposta = await entregador
      .post(`/pedidos/${idPedido}/finalizar`)
      .send({ codigo: codigoRecebedor })
      .expect(200);

    // Cantina no seed: taxa de R$ 8,00 mais R$ 1,50 por km, sobre 2 km.
    expect(resposta.body).toMatchObject({
      status: 'FINALIZADO',
      ganhoConsolidadoCentavos: 1100,
    });
  });

  it('encerra o rastreio depois da entrega', () => {
    return request(app.getHttpServer()).get(`/rastreio/${token}`).expect(410);
  });

  it('libera a avaliacao depois da entrega', async () => {
    const resposta = await request(app.getHttpServer())
      .get(`/rastreio/${token}/avaliacao`)
      .expect(200);

    expect(resposta.body).toEqual({ situacao: 'disponivel', avaliacao: null });
  });

  it('recebe a nota e depois o comentario do recebedor', async () => {
    const servidor = request(app.getHttpServer());

    await servidor
      .post(`/rastreio/${token}/avaliacao`)
      .send({ nota: 5 })
      .expect(201);
    const resposta = await servidor
      .patch(`/rastreio/${token}/avaliacao`)
      .send({ comentario: 'Chegou rapido' })
      .expect(200);

    expect(resposta.body).toMatchObject({
      situacao: 'avaliado',
      avaliacao: { nota: 5, comentario: 'Chegou rapido' },
    });
  });

  it('nao aceita uma segunda nota', () => {
    return request(app.getHttpServer())
      .post(`/rastreio/${token}/avaliacao`)
      .send({ nota: 1 })
      .expect(409);
  });

  it('mostra a avaliacao so para a empresa do pedido', async () => {
    const daCantina = await cantina.get('/avaliacoes').expect(200);
    const daPadaria = await padaria.get('/avaliacoes').expect(200);

    expect(daCantina.body as AvaliacaoNaLista[]).toContainEqual(
      expect.objectContaining({
        idPedido,
        nota: 5,
        comentario: 'Chegou rapido',
      }),
    );
    expect(
      (daPadaria.body as AvaliacaoNaLista[]).map((a) => a.idPedido),
    ).not.toContain(idPedido);
  });
});
