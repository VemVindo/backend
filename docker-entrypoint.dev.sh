#!/bin/sh
set -e

echo "[entrypoint] Gerando Prisma Client"
npx prisma generate

echo "[entrypoint] Aplicando migrations"
npx prisma migrate deploy

echo "[entrypoint] Iniciando NestJS em modo dev"
exec npm run start:dev
