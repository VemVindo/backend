-- AlterTable
ALTER TABLE "Contrato" ALTER COLUMN "data_fim" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Entregador" RENAME COLUMN "is_online" TO "disponivel";
ALTER TABLE "Entregador" ALTER COLUMN "disponivel" SET DEFAULT true;
ALTER TABLE "Entregador" ADD COLUMN "senha_temporaria" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Entregador" ALTER COLUMN "placa" DROP NOT NULL;
