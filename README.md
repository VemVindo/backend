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

### Dados de teste

Em dev, o `CMD` do `Dockerfile.dev` roda `prisma/seed/dev.sql` depois das
migrations, a cada subida do container. O script é idempotente e nunca roda
em produção. Fora do Docker: `npm run db:seed`.

Todos os dados são fictícios.

| Perfil | Login | Senha | Observação |
|---|---|---|---|
| Empresa (CNPJ) | `cantina@example.com` | `Vemvindo@123` | frota: Bruno; convite pendente para a Ana |
| Empresa (CPF) | `padaria@example.com` | `Vemvindo@123` | frota: Carla; convite pendente para o Bruno |
| Entregador | `12345678909` (Ana) | `Temp@2026` | primeiro acesso: troca de senha e convite da Cantina |
| Entregador | `98765432100` (Bruno) | `Vemvindo@123` | ativo na Cantina, convite pendente da Padaria |
| Entregador | `24681357928` (Carla) | `Vemvindo@123` | bicicleta, sem placa |

Pedidos (só entram com a tabela de pedidos vazia):

- **Cantina:**
  - dois pedidos `PENDENTE`, sem entregador;
  - um `FINALIZADO` pelo Bruno.
- **Padaria:**
  - um `EM_ANDAMENTO` com a Carla, que por isso começa indisponível;
  - um `FINALIZADO` pela Carla.

Cada pedido com entregador abre o histórico de entregadores, como faz a API.

Para voltar ao estado inicial (por exemplo, refazer o primeiro acesso da Ana):
`docker compose down -v && docker compose up`.

## Autenticação

Cadastro apenas para estabelecimentos (`Empresa`); login separado por persona.

| Método | Rota | Corpo |
|---|---|---|
| POST | `/auth/cadastrar/empresa` | dados do estabelecimento |
| POST | `/auth/login/empresa` | `email`, `senha` |
| POST | `/auth/login/entregador` | `cpf`, `senha` |
| GET | `/auth/minhas-infos` | - |
| POST | `/auth/entregador/trocar-senha` | `senhaAtual`, `novaSenha`, `cienteDadosCompartilhados` |
| POST | `/auth/sair` | - |

O login grava o JWT (`sub`, `cargo`, `empresaId` para empresas e
`senhaTemporaria` para entregadores) num cookie `httpOnly` chamado
`vemvindo_token`; o corpo da resposta traz só `{ usuario }`. O header
`Authorization: Bearer` continua aceito para clientes de API. Tokens emitidos
antes da tradução (com `role`) são recusados: basta entrar de novo.

Todo CPF (cadastro, vínculo e login) deve ter só os 11 dígitos, sem pontos ou
traço, e dígitos verificadores válidos (`@IsCpf()`). Senhas novas (cadastro e
troca) têm de 8 a 72 caracteres e só aceitam letras sem acento, números e
símbolos do teclado, sem espaços: assim cada caractere ocupa 1 byte e o limite
de 72 bytes do bcrypt nunca corta a senha.

Enquanto o entregador estiver com senha temporária, todas as rotas respondem
403, exceto `/auth/minhas-infos`, `/auth/entregador/trocar-senha`, `/auth/sair`,
`/entregador/dados-compartilhados` e `/entregador/vinculos` (GET). No primeiro
acesso a troca de senha exige `cienteDadosCompartilhados: true`: o app mostra
antes quais dados as empresas veem.

Todas as respostas saem com `Cache-Control: no-store`.

## Frota e vínculos (LGPD)

O vínculo entre empresa e entregador é um convite: nasce `PENDENTE` e só vira
`ATIVO` quando o entregador aceita no app. Enquanto não houver aceite, a empresa
não recebe nenhum dado pessoal dele.

| Quem | Método | Rota | O que faz |
|---|---|---|---|
| Empresa | POST | `/entregadores` | cadastra entregador novo; devolve a senha temporária e o convite fica `PENDENTE` |
| Empresa | POST | `/entregadores/vinculo` | convida pelo CPF; responde `202` com a mesma mensagem para qualquer CPF |
| Empresa | GET | `/entregadores` | frota: só vínculos `ATIVO` |
| Empresa | DELETE | `/entregadores/:cpf/vinculo` | encerra o vínculo ativo |
| Entregador | GET | `/entregador/dados-compartilhados` | o mesmo objeto que a empresa recebe na frota |
| Entregador | GET | `/entregador/vinculos` | convites pendentes e vínculos ativos |
| Entregador | POST | `/entregador/vinculos/:id/aceitar` | aceita o convite |
| Entregador | POST | `/entregador/vinculos/:id/recusar` | recusa o convite |
| Entregador | POST | `/entregador/vinculos/:id/encerrar` | sai da frota |

O que a empresa vê de um entregador com vínculo ativo está definido num único
lugar, `src/entregador/dados-visiveis-empresa.ts`: nome, CPF, tipo de veículo,
placa e disponibilidade. Depois do desvínculo (`RECUSADO` ou `ENCERRADO`) a
empresa perde esses dados e fica só com o histórico dos pedidos feitos para
ela. Rota nova que leia dados do entregador pelo lado da empresa precisa exigir
vínculo `ATIVO`.

Cadastro e convite aceitam até 10 requisições por minuto por IP.

## Healthcheck

`GET /health/db` executa `SELECT 1` no banco e retorna `{ "database": "up" }`.

## Variáveis de ambiente

Nenhum segredo é versionado. Em runtime o backend consome:

- `DATABASE_URL`, `DIRECT_URL`
- `JWT_SECRET`, `JWT_EXPIRES_IN`
- `CORS_ORIGIN` (default `http://localhost:3000`)
- `PORT` (opcional)

## CI/CD

Cada PR para a `main` roda `.github/workflows/ci.yml`. O merge só é liberado com:

- o check **CI ok** verde (ele agrega os jobs abaixo);
- o check **Titulo do PR** verde: título em Conventional Commits, porque com squash merge o título vira o commit na main;
- nenhum alerta alto do CodeQL;
- **1 aprovação** de outra pessoa, dada depois do último push.

| Job | Barra o merge quando |
|---|---|
| Lint e formatacao | ESLint ou Prettier apontam erro |
| Typecheck | `tsc` falha, inclusive nos testes |
| Testes unitarios | algum teste falha, linhas abaixo de 60% ou queda de mais de 1 ponto em relação à main |
| Testes e2e e de API | migrations ou seed falham num banco limpo, o e2e do Jest falha ou a coleção do Postman (`test/postman/`) falha |
| Schema e migrations | o `schema.prisma` mudou sem migration |
| Seguranca | vulnerabilidade alta em dependência de produção, ou dependência nova com vulnerabilidade ou licença GPL/AGPL |
| Imagem Docker | o build falha ou o Trivy acha vulnerabilidade crítica com correção |

O job **Relatorio** publica no resumo da execução e num comentário fixo do PR:

- a porcentagem de testes passando;
- a cobertura comparada com a main;
- o resultado de cada etapa.

O push na main publica a imagem no GHCR, faz o deploy no Render e confere a URL pública.

Configuração única, feita por quem é admin do repositório:

```bash
# protecao da main (aprovacao, checks obrigatorios, squash)
gh api -X POST repos/VemVindo/backend/rulesets --input .github/rulesets/main.json
```

Em Settings > Secrets and variables > Actions:

- secret `RENDER_DEPLOY_HOOK`;
- variável `API_PUBLIC_URL` (smoke test do deploy).

Para rodar o mesmo que o CI, localmente: `npm run lint:check && npm run format:check && npm run typecheck && npm run test:ci`.

## Scripts úteis

```bash
npm run start:dev   # dev com watch (fora de container)
npm run build       # build de producao
npm run lint        # eslint
npm test            # testes
npm run test:ci     # testes com cobertura e relatorios (o mesmo do CI)
npm run db:seed     # dados de teste no banco de dev
```
