# VemVindo Backend

API do VemVindo, plataforma multitenant de rastreamento de entregas. Construída
com NestJS 11 e Prisma 7.

## Stack

- NestJS 11
- Prisma 7 com driver adapter (`@prisma/adapter-pg`)
- PostgreSQL 18 (local em dev, Supabase em produção)
- Autenticação com JWT (`@nestjs/jwt`, `passport-jwt`) e hash bcrypt

## Pré-requisitos

- Docker e Docker Compose
- Node 24 (apenas se for rodar fora de container)

## Ambiente de desenvolvimento

O `compose.yaml` sobe o Postgres local e o backend em modo dev com hot reload.

```bash
docker compose up
```

O backend fica em `http://localhost:8000` (o container escuta na 3000; a 8000 é a
porta publicada). O banco fica em `localhost:5432`. O backend só inicia depois do
healthcheck do banco passar.

Para que alterações de código reflitam no container em execução, use o Compose
Watch:

```bash
docker compose watch
```

### Serviços do Compose

- `nestjs-dev`: backend em modo dev. Sobe no `up` padrão.
- `database`: Postgres 18 local, com volume nomeado `pgdata`.
- `nestjs-prod`: imagem de produção, sob o profile `prod`
  (`docker compose --profile prod up`).

## Banco de dados e migrations

As migrations são um passo separado do boot, executado por dentro do container:

```bash
docker compose exec nestjs-dev npx prisma migrate dev
```

Duas variáveis controlam a conexão:

- `DATABASE_URL`: conexão de runtime.
- `DIRECT_URL`: conexão direta usada pelas migrations.

Em dev as duas apontam para o serviço `database`. Em produção apontam para o
Supabase, com credenciais vindas de um `.env` não versionado.

## Autenticação

Cadastro apenas para estabelecimentos (`Empresa`); login separado por persona.

| Método | Rota | Corpo |
|---|---|---|
| POST | `/auth/register` | dados do estabelecimento |
| POST | `/auth/login/empresa` | `email`, `senha` |
| POST | `/auth/login/entregador` | `cpf`, `senha` |

O login bem-sucedido retorna `accessToken` (JWT com `sub`, `role` e, para
empresas, `establishmentId`) e os dados do usuário.

## Healthcheck

`GET /health/db` executa `SELECT 1` no banco e retorna `{ "database": "up" }`.

## Variáveis de ambiente

Nenhum segredo é versionado. Em runtime o backend consome:

- `DATABASE_URL`, `DIRECT_URL`
- `JWT_SECRET`, `JWT_EXPIRES_IN`
- `CORS_ORIGIN` (default `http://localhost:3000`)
- `PORT` (opcional)

## Scripts úteis

```bash
npm run start:dev   # dev com watch (fora de container)
npm run build       # build de producao
npm run lint        # eslint
npm test            # testes
```
