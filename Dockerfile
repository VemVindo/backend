# ============================================
# Stage 1: build (instala tudo e compila o TypeScript)
# ============================================
FROM node:24.14.0-slim AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ============================================
# Stage 2: dependencias de producao (sem devDependencies)
# ============================================
FROM node:24.14.0-slim AS prod-deps

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --omit=dev

# ============================================
# Stage 3: runner (imagem final minima)
# ============================================
FROM node:24.14.0-slim AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production

COPY --from=prod-deps /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist
COPY package.json ./

# Usuario nao-root ja existente na imagem oficial do Node
USER node

EXPOSE 3000

CMD ["node", "dist/main"]
