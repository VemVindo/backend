import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  BRUNO,
  CANTINA,
  PADARIA,
  SENHA_DO_SEED,
  Sessao,
  entrarComoEmpresa,
  entrarComoEntregador,
  subirAplicacao,
} from './apoio/aplicacao';

interface EntregadorDaFrota {
  nome: string;
  cpf: string;
}

describe('Sessao, acesso e frota (e2e)', () => {
  let app: INestApplication<App>;
  // O login aceita 5 tentativas por minuto: cada persona entra uma vez so.
  let cantina: Sessao;
  let bruno: Sessao;

  beforeAll(async () => {
    app = await subirAplicacao();
    cantina = await entrarComoEmpresa(app, CANTINA.email);
    bruno = await entrarComoEntregador(app, BRUNO);
  });

  afterAll(async () => {
    await app.close();
  });

  it('responde que o banco esta no ar', () => {
    return request(app.getHttpServer())
      .get('/health/db')
      .expect(200)
      .expect({ database: 'up' });
  });

  it('recusa login com senha errada', () => {
    return request(app.getHttpServer())
      .post('/auth/login/empresa')
      .send({ email: CANTINA.email, senha: 'SenhaErrada@1' })
      .expect(401);
  });

  it('grava a sessao em cookie httpOnly e sem devolver o token no corpo', async () => {
    const resposta = await request(app.getHttpServer())
      .post('/auth/login/empresa')
      .send({ email: PADARIA.email, senha: SENHA_DO_SEED })
      .expect(200);

    // Em runtime e uma lista; String() junta os cookies para a comparacao.
    const cookies = String(resposta.get('Set-Cookie'));
    expect(cookies).toMatch(/vemvindo_token=.+HttpOnly/i);
    expect(JSON.stringify(resposta.body)).not.toContain('tokenAcesso');
  });

  it('mostra quem esta logado e encerra a sessao ao sair', async () => {
    const empresa = await entrarComoEmpresa(app, CANTINA.email);

    const eu = await empresa.get('/auth/minhas-infos').expect(200);
    expect(eu.body).toMatchObject({
      email: CANTINA.email,
      cargo: 'ESTABELECIMENTO',
    });

    await empresa.post('/auth/sair').expect(204);
    await empresa.get('/auth/minhas-infos').expect(401);
  });

  it('identifica o entregador pelo CPF', async () => {
    const eu = await bruno.get('/auth/minhas-infos').expect(200);

    expect(eu.body).toMatchObject({ cpf: BRUNO, cargo: 'ENTREGADOR' });
  });

  it.each([
    ['empresa', '/pedidos/minhas-entregas'],
    ['entregador', '/pedidos'],
    ['entregador', '/entregadores'],
  ])('recusa %s em %s, rota de outro cargo', async (quem, rota) => {
    const agente = quem === 'empresa' ? cantina : bruno;

    await agente.get(rota).expect(403);
  });

  it('lista so a frota ativa da propria empresa', async () => {
    const resposta = await cantina.get('/entregadores').expect(200);
    const cpfs = (resposta.body as EntregadorDaFrota[]).map((e) => e.cpf);

    // Bruno e ativo na Cantina; Ana so tem convite pendente; Carla e da Padaria.
    expect(cpfs).toContain('98765432100');
    expect(cpfs).not.toContain('12345678909');
    expect(cpfs).not.toContain('24681357928');
  });
});
