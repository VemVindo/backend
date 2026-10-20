-- AlterTable
ALTER TABLE "Avaliacao" ADD COLUMN     "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "comentario" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Avaliacao_data_idx" ON "Avaliacao"("data");

