-- CreateEnum
CREATE TYPE "StatusContrato" AS ENUM ('PENDENTE', 'ATIVO', 'RECUSADO', 'ENCERRADO');

-- AlterTable
ALTER TABLE "Entregador" ADD COLUMN     "ciencia_dados_em" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Contrato" ADD COLUMN     "data_aceite" TIMESTAMP(3),
ADD COLUMN     "status" "StatusContrato" NOT NULL DEFAULT 'PENDENTE';

-- Vinculos ja encerrados continuam encerrados. Os abertos foram criados sem
-- aceite do entregador, entao ficam PENDENTE ate ele aceitar no app.
UPDATE "Contrato" SET "status" = 'ENCERRADO' WHERE "data_fim" IS NOT NULL;
