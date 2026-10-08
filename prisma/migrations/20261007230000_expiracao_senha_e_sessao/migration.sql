-- AlterTable
ALTER TABLE "Empresa" ADD COLUMN     "sessao_versao" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Entregador" ADD COLUMN     "senha_temporaria_expira_em" TIMESTAMP(3),
ADD COLUMN     "sessao_versao" INTEGER NOT NULL DEFAULT 0;

-- Senhas temporarias que ja existiam ganham o prazo a partir de agora; sem
-- prazo, o login trataria a senha como expirada.
UPDATE "Entregador" SET "senha_temporaria_expira_em" = NOW() + INTERVAL '48 hours' WHERE "senha_temporaria" = true;
