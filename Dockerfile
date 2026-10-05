# ============================================
# Stage 1: build (instala tudo e compila o TypeScript)
# ============================================
FROM node:24.21.0-slim AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY . .
# O Prisma Client e gerado em src/generated (fora do git); sem ele o build
# nao compila. A URL e so um placeholder: o generate nao conecta no banco.
RUN DIRECT_URL=postgresql://build:build@localhost:5432/build npx prisma generate \
    && npm run build

# ============================================
# Stage 2: dependencias de producao (sem devDependencies)
# ============================================
FROM node:24.21.0-slim AS prod-deps

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --omit=dev

# ============================================
# Stage 3: runner (imagem final minima)
# ============================================
FROM node:24.21.0-slim AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production

COPY --from=prod-deps /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist
COPY package.json ./
# Schema, migrations e config do Prisma, para o migrate deploy na subida.
# O seed de dev (prisma/seed) fica de fora da imagem.
COPY prisma/schema.prisma ./prisma/
COPY prisma/migrations ./prisma/migrations
COPY prisma7.config.ts ./

# Usuario nao-root ja existente na imagem oficial do Node
USER node

EXPOSE 3000

# Aplica as migrations pendentes (usa DIRECT_URL) e sobe a API. O migrate
# deploy usa lock no banco, entao duas instancias subindo juntas nao conflitam.
# O seed de desenvolvimento nunca roda aqui.
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/main"]
