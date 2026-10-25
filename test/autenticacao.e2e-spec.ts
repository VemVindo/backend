import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import {
  ANA,
  BRUNO,
  CANTINA,
  PADARIA,
  SENHA_DO_SEED,
  SENHA_TEMPORARIA_DA_ANA,
  Sessao,
  entrarComoEmpresa,
  entrarComoEntregador,
  semLogin,
  subirAplicacao,
} from './apoio/aplicacao';

interface PedidoDaLista {
  id: number;
  recebedor: string;
}

describe('EN-US01 login e isolamento entre empresas (e2e)', () => {
  let aplicacao: INestApplication<App>;
  let cantina: Sessao;
  let padaria: Sessao;

  beforeAll(async () => {
    aplicacao = await subirAplicacao();
    cantina = await entrarComoEmpresa(aplicacao, CANTINA.email);
    padaria = await entrarComoEmpresa(aplicacao, PADARIA.email);
  });

  afterAll(async () => {
    await aplicacao.close();
  });

  it('grava a sessao num cookie httpOnly e devolve so os dados do usuario', async () => {
    const resposta = await semLogin(aplicacao)
      .post('/auth/login/empresa')
      .send({ email: CANTINA.email, senha: SENHA_DO_SEED })
      .expect(200);

    const cookie = String(resposta.headers['set-cookie']);
    expect(cookie).toMatch(/^vemvindo_token=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(JSON.stringify(resposta.body)).not.toMatch(/senha|token/i);
  });

  it('responde igual para senha errada e para e-mail que nao existe', async () => {
    const senhaErrada = await semLogin(aplicacao)
      .post('/auth/login/empresa')
      .send({ email: CANTINA.email, senha: 'Errada@123' })
      .expect(401);
    const emailInexistente = await semLogin(aplicacao)
      .post('/auth/login/empresa')
      .send({ email: 'ninguem@example.com', senha: 'Errada@123' })
      .expect(401);

    expect(emailInexistente.body).toEqual(senhaErrada.body);
  });

  it('responde igual para senha errada e para CPF que nao existe', async () => {
    const senhaErrada = await semLogin(aplicacao)
      .post('/auth/login/entregador')
      .send({ cpf: BRUNO, senha: 'Errada@123' })
      .expect(401);
    const cpfInexistente = await semLogin(aplicacao)
      .post('/auth/login/entregador')
      .send({ cpf: '52998224725', senha: 'Errada@123' })
      .expect(401);

    expect(cpfInexistente.body).toEqual(senhaErrada.body);
  });

  it('recusa quem nao fez login', async () => {
    await semLogin(aplicacao).get('/auth/minhas-infos').expect(401);
  });

  it('nao deixa o navegador guardar os dados da sessao em cache', async () => {
    const resposta = await cantina.get('/auth/minhas-infos').expect(200);

    expect(resposta.headers['cache-control']).toBe('no-store');
  });

  it('nao deixa uma empresa abrir o pedido de outra', async () => {
    const pedidosDaCantina = (await cantina.get('/pedidos').expect(200))
      .body as PedidoDaLista[];
    const pedidosDaPadaria = (await padaria.get('/pedidos').expect(200))
      .body as PedidoDaLista[];
    const pedidoDaCantina = pedidosDaCantina[0];

    await padaria.get(`/pedidos/${pedidoDaCantina.id}`).expect(404);
    expect(pedidosDaPadaria.map((pedido) => pedido.id)).not.toContain(
      pedidoDaCantina.id,
    );
  });

  it('nao deixa o entregador usar rota de empresa', async () => {
    const bruno = await entrarComoEntregador(aplicacao, BRUNO);

    await bruno.get('/pedidos').expect(403);
  });

  it('com senha temporaria, so libera a troca de senha e as telas do primeiro acesso', async () => {
    const ana = await entrarComoEntregador(
      aplicacao,
      ANA,
      SENHA_TEMPORARIA_DA_ANA,
    );

    const body: unknown = (await ana.get('/auth/minhas-infos').expect(200))
      .body;
    expect(body).toMatchObject({ senhaTemporaria: true });
    await ana.get('/entregador/vinculos').expect(200);
    await ana.get('/entregador/dados-compartilhados').expect(200);
    await ana.get('/pedidos/minhas-entregas').expect(403);
  });

  it('sair de todos os aparelhos invalida tambem os cookies ja emitidos', async () => {
    const login = await semLogin(aplicacao)
      .post('/auth/login/entregador')
      .send({ cpf: ANA, senha: SENHA_TEMPORARIA_DA_ANA })
      .expect(200);
    const cookieAntigo = String(login.headers['set-cookie']).split(';')[0];

    await semLogin(aplicacao)
      .post('/auth/sair-de-todos')
      .set('Cookie', cookieAntigo)
      .expect(204);
    await semLogin(aplicacao)
      .get('/auth/minhas-infos')
      .set('Cookie', cookieAntigo)
      .expect(401);
  });

  it('ao sair, o navegador apaga o cookie', async () => {
    await padaria.post('/auth/sair').expect(204);
    await padaria.get('/auth/minhas-infos').expect(401);
  });
});
