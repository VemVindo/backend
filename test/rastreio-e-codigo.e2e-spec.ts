import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import {
  BRUNO,
  CANTINA,
  CARLA,
  PADARIA,
  Sessao,
  entrarComoEmpresa,
  entrarComoEntregador,
  semLogin,
  subirAplicacao,
} from './apoio/aplicacao';

interface PedidoDaLista {
  id: number;
  recebedor: string;
  status: string;
}

interface PedidoCriado {
  id_pedido: number;
}

interface LinkGerado {
  link: string;
  codigoRecebedor: string;
}

const RECEBEDOR_DO_PEDIDO_EM_ANDAMENTO = 'Pedro Alves';
const TELEFONE_DO_RECEBEDOR = '61920000004';

function tokenDoLink(link: string): string {
  return link.split('/').at(-1) ?? '';
}

function codigoErrado(certo: string): string {
  return certo === '000000' ? '111111' : '000000';
}

describe('R-US01 link sem login e EN-US06 codigo do recebedor (e2e)', () => {
  let aplicacao: INestApplication<App>;
  let padaria: Sessao;
  let cantina: Sessao;
  let carla: Sessao;
  let idPedido: number;
  let primeiroLink: LinkGerado;
  let linkAtual: LinkGerado;

  beforeAll(async () => {
    aplicacao = await subirAplicacao();
    padaria = await entrarComoEmpresa(aplicacao, PADARIA.email);
    cantina = await entrarComoEmpresa(aplicacao, CANTINA.email);
    carla = await entrarComoEntregador(aplicacao, CARLA);
    const pedidos = (await padaria.get('/pedidos').expect(200))
      .body as PedidoDaLista[];
    const emAndamento = pedidos.find(
      (pedido) => pedido.recebedor === RECEBEDOR_DO_PEDIDO_EM_ANDAMENTO,
    );
    idPedido = emAndamento?.id ?? 0;
  });

  afterAll(async () => {
    await aplicacao.close();
  });

  it('parte de um pedido em andamento com a Carla', () => {
    expect(idPedido).toBeGreaterThan(0);
  });

  it('nao finaliza pela troca de status, que nao pede o codigo', async () => {
    await carla
      .patch(`/pedidos/${idPedido}/status`)
      .send({ status: 'FINALIZADO' })
      .expect(409);
  });

  it('antes do link, avisa que o recebedor ainda nao tem codigo', async () => {
    const body: unknown = (
      await carla
        .post(`/pedidos/${idPedido}/finalizar`)
        .send({ codigo: '123456' })
        .expect(409)
    ).body;

    expect((body as { message: string }).message).toContain('link');
  });

  it('nao deixa outra empresa gerar link para o pedido', async () => {
    await cantina.post(`/pedidos/${idPedido}/link-rastreio`).expect(404);
  });

  it('a empresa gera o link com um codigo de 6 numeros', async () => {
    primeiroLink = (
      await padaria.post(`/pedidos/${idPedido}/link-rastreio`).expect(200)
    ).body as LinkGerado;

    expect(primeiroLink.codigoRecebedor).toMatch(/^\d{6}$/);
    expect(tokenDoLink(primeiroLink.link).length).toBeGreaterThanOrEqual(32);
  });

  it('o recebedor abre o link sem login e ve so o necessario', async () => {
    const body: unknown = (
      await semLogin(aplicacao)
        .get(`/rastreio/${tokenDoLink(primeiroLink.link)}`)
        .expect(200)
    ).body;

    expect(body).toMatchObject({
      estabelecimento: PADARIA.nome,
      entregador: 'Carla',
      codigoRecebedor: primeiroLink.codigoRecebedor,
    });
    expect(JSON.stringify(body)).not.toContain(CARLA);
    expect(JSON.stringify(body)).not.toContain(TELEFONE_DO_RECEBEDOR);
  });

  it('recusa token que nao existe', async () => {
    await semLogin(aplicacao)
      .get('/rastreio/token-que-nao-existe-em-lugar-nenhum')
      .expect(404);
  });

  it('gerar outro link derruba o anterior e mantem o mesmo codigo', async () => {
    linkAtual = (
      await padaria.post(`/pedidos/${idPedido}/link-rastreio`).expect(200)
    ).body as LinkGerado;

    expect(linkAtual.codigoRecebedor).toBe(primeiroLink.codigoRecebedor);
    await semLogin(aplicacao)
      .get(`/rastreio/${tokenDoLink(primeiroLink.link)}`)
      .expect(404);
    await semLogin(aplicacao)
      .get(`/rastreio/${tokenDoLink(linkAtual.link)}`)
      .expect(200);
  });

  it('recusa codigo que nao tem 6 numeros', async () => {
    await carla
      .post(`/pedidos/${idPedido}/finalizar`)
      .send({ codigo: '12a456' })
      .expect(400);
  });

  it('codigo errado responde quantas tentativas restam', async () => {
    const body: unknown = (
      await carla
        .post(`/pedidos/${idPedido}/finalizar`)
        .send({ codigo: codigoErrado(linkAtual.codigoRecebedor) })
        .expect(422)
    ).body;

    expect(body).toMatchObject({ tentativasRestantes: 4 });
  });

  it('a empresa nao finaliza no lugar do entregador', async () => {
    await padaria
      .post(`/pedidos/${idPedido}/finalizar`)
      .send({ codigo: linkAtual.codigoRecebedor })
      .expect(403);
  });

  it('com o codigo certo, finaliza a entrega', async () => {
    const body: unknown = (
      await carla
        .post(`/pedidos/${idPedido}/finalizar`)
        .send({ codigo: linkAtual.codigoRecebedor })
        .expect(200)
    ).body;

    expect(body).toMatchObject({ id: idPedido, status: 'FINALIZADO' });
  });

  it('nao finaliza duas vezes', async () => {
    await carla
      .post(`/pedidos/${idPedido}/finalizar`)
      .send({ codigo: linkAtual.codigoRecebedor })
      .expect(409);
  });

  it('depois da entrega o link de rastreio expira', async () => {
    await semLogin(aplicacao)
      .get(`/rastreio/${tokenDoLink(linkAtual.link)}`)
      .expect(410);
  });

  describe('limite de tentativas do codigo', () => {
    let bruno: Sessao;
    let idPedidoDoBruno: number;
    let codigoDoBruno: string;

    function tentar(codigo: string) {
      return bruno
        .post(`/pedidos/${idPedidoDoBruno}/finalizar`)
        .send({ codigo });
    }

    beforeAll(async () => {
      idPedidoDoBruno = (
        (
          await cantina
            .post('/pedidos')
            .send({
              nome_recebedor: 'Recebedor do Limite',
              telefone_recebedor: '61920000010',
              cep: '70390070',
              logradouro: 'SHCS 706 Bloco B',
              numero: 12,
              bairro: 'Asa Sul',
              cidade: 'Brasilia',
              uf: 'DF',
              descricao: 'Pedido do teste de limite',
              tipo_veiculo: 'DRIVE',
              cpf_entregador: BRUNO,
            })
            .expect(201)
        ).body as PedidoCriado
      ).id_pedido;
      codigoDoBruno = (
        (
          await cantina
            .post(`/pedidos/${idPedidoDoBruno}/link-rastreio`)
            .expect(200)
        ).body as LinkGerado
      ).codigoRecebedor;
      bruno = await entrarComoEntregador(aplicacao, BRUNO);
    });

    it('conta as tentativas erradas ate acabarem', async () => {
      const restantes: unknown[] = [];
      for (let tentativa = 0; tentativa < 5; tentativa++) {
        const resposta = await tentar(codigoErrado(codigoDoBruno)).expect(422);
        restantes.push(
          (resposta.body as { tentativasRestantes: number })
            .tentativasRestantes,
        );
      }

      expect(restantes).toEqual([4, 3, 2, 1, 0]);
    });

    it('depois do limite, bloqueia ate o codigo certo e diz quando libera', async () => {
      const resposta = await tentar(codigoDoBruno).expect(429);
      const liberaEm = new Date(
        (resposta.body as { liberaEm: string }).liberaEm,
      );

      expect(liberaEm.getTime()).toBeGreaterThan(Date.now());
    });
  });
});
