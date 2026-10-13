-- CreateEnum
CREATE TYPE "StatusPedido" AS ENUM ('PENDENTE', 'EM_ANDAMENTO', 'FINALIZADO', 'CANCELADO');

-- AlterTable
-- Converte os textos gravados antes do enum ('Pendente', 'Em andamento', ...).
ALTER TABLE "Pedido" ALTER COLUMN "status" TYPE "StatusPedido" USING (
  CASE "status"
    WHEN 'Pendente' THEN 'PENDENTE'
    WHEN 'Em andamento' THEN 'EM_ANDAMENTO'
    WHEN 'Finalizado' THEN 'FINALIZADO'
    WHEN 'Cancelado' THEN 'CANCELADO'
    ELSE "status"
  END
)::"StatusPedido";
ALTER TABLE "Pedido" ALTER COLUMN "status" SET DEFAULT 'PENDENTE';

-- AlterTable
ALTER TABLE "HistoricoPedidoEntregadores" ALTER COLUMN "cpf_entregador_antigo" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "HistoricoPedidoEntregadores_id_pedido_idx" ON "HistoricoPedidoEntregadores"("id_pedido");
