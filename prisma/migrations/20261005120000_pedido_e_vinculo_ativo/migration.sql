-- RenameColumn
ALTER TABLE "Pedido" RENAME COLUMN "nome_reccebedor" TO "nome_recebedor";

-- AlterTable
ALTER TABLE "Pedido" ALTER COLUMN "cpf_entregador" DROP NOT NULL,
ALTER COLUMN "complemento" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Contrato_vinculo_ativo_key" ON "Contrato"("idEmpresa", "cpf_entregador") WHERE ("data_fim" IS NULL);
