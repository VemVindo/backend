import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import TestAgent from 'supertest/lib/agent';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';

export { gerarCpfValido } from './cpf';

export type Sessao = TestAgent;

export const SENHA_DO_SEED = 'Vemvindo@123';
export const SENHA_TEMPORARIA_DA_ANA = 'Temp@2026';

export const CANTINA = {
  email: 'cantina@example.com',
  nome: 'Cantina Dona Marta',
};
export const PADARIA = {
  email: 'padaria@example.com',
  nome: 'Padaria Pao Quente',
};

export const ANA = '12345678909';
export const BRUNO = '98765432100';
export const CARLA = '24681357928';

export async function subirAplicacao(): Promise<INestApplication<App>> {
  const modulo = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const aplicacao = modulo.createNestApplication<INestApplication<App>>();
  aplicacao.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await aplicacao.init();
  return aplicacao;
}

export async function entrarComoEmpresa(
  aplicacao: INestApplication<App>,
  email: string,
): Promise<Sessao> {
  const sessao = request.agent(aplicacao.getHttpServer());
  await sessao
    .post('/auth/login/empresa')
    .send({ email, senha: SENHA_DO_SEED })
    .expect(200);
  return sessao;
}

export async function entrarComoEntregador(
  aplicacao: INestApplication<App>,
  cpf: string,
  senha = SENHA_DO_SEED,
): Promise<Sessao> {
  const sessao = request.agent(aplicacao.getHttpServer());
  await sessao.post('/auth/login/entregador').send({ cpf, senha }).expect(200);
  return sessao;
}

export function semLogin(aplicacao: INestApplication<App>) {
  return request(aplicacao.getHttpServer());
}

export function identificadorUnico(prefixo: string): string {
  return `${prefixo}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}
