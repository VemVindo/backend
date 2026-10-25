import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

// Mesma configuracao do main.ts que interfere nas rotas: o ValidationPipe global.
export async function criarAppDeTeste(): Promise<INestApplication<App>> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication<INestApplication<App>>();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  return app;
}

// Credenciais do seed de desenvolvimento (prisma/seed/dev.sql), todas ficticias.
export const CANTINA = { email: 'cantina@example.com', senha: 'Vemvindo@123' };
export const PADARIA = { email: 'padaria@example.com', senha: 'Vemvindo@123' };
export const BRUNO = { cpf: '98765432100', senha: 'Vemvindo@123' };

export type Agente = ReturnType<typeof request.agent>;

export async function entrarComoEmpresa(
  app: INestApplication<App>,
  credenciais: { email: string; senha: string },
): Promise<Agente> {
  const agente = request.agent(app.getHttpServer());
  await agente.post('/auth/login/empresa').send(credenciais).expect(200);
  return agente;
}

export async function entrarComoEntregador(
  app: INestApplication<App>,
  credenciais: { cpf: string; senha: string },
): Promise<Agente> {
  const agente = request.agent(app.getHttpServer());
  await agente.post('/auth/login/entregador').send(credenciais).expect(200);
  return agente;
}
