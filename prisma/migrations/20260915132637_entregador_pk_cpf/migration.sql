/*
  Warnings:

  - You are about to drop the column `identregadores` on the `Contrato` table. All the data in the column will be lost.
  - The primary key for the `Entregador` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id_entregador` on the `Entregador` table. All the data in the column will be lost.
  - You are about to drop the column `id_entregador_antigo` on the `HistoricoPedidoEntregadores` table. All the data in the column will be lost.
  - You are about to drop the column `id_entregador_novo` on the `HistoricoPedidoEntregadores` table. All the data in the column will be lost.
  - You are about to drop the column `identregadores` on the `Pedido` table. All the data in the column will be lost.
  - Added the required column `cpf_entregador` to the `Contrato` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cpf_entregador_antigo` to the `HistoricoPedidoEntregadores` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cpf_entregador_novo` to the `HistoricoPedidoEntregadores` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cpf_entregador` to the `Pedido` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Contrato" DROP CONSTRAINT "Contrato_identregadores_fkey";

-- DropForeignKey
ALTER TABLE "HistoricoPedidoEntregadores" DROP CONSTRAINT "HistoricoPedidoEntregadores_id_entregador_antigo_fkey";

-- DropForeignKey
ALTER TABLE "HistoricoPedidoEntregadores" DROP CONSTRAINT "HistoricoPedidoEntregadores_id_entregador_novo_fkey";

-- DropForeignKey
ALTER TABLE "Pedido" DROP CONSTRAINT "Pedido_identregadores_fkey";

-- DropIndex
DROP INDEX "Entregador_cpf_key";

-- AlterTable
ALTER TABLE "Contrato" DROP COLUMN "identregadores",
ADD COLUMN     "cpf_entregador" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Entregador" DROP CONSTRAINT "Entregador_pkey",
DROP COLUMN "id_entregador",
ADD CONSTRAINT "Entregador_pkey" PRIMARY KEY ("cpf");

-- AlterTable
ALTER TABLE "HistoricoPedidoEntregadores" DROP COLUMN "id_entregador_antigo",
DROP COLUMN "id_entregador_novo",
ADD COLUMN     "cpf_entregador_antigo" TEXT NOT NULL,
ADD COLUMN     "cpf_entregador_novo" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Pedido" DROP COLUMN "identregadores",
ADD COLUMN     "cpf_entregador" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_cpf_entregador_fkey" FOREIGN KEY ("cpf_entregador") REFERENCES "Entregador"("cpf") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricoPedidoEntregadores" ADD CONSTRAINT "HistoricoPedidoEntregadores_cpf_entregador_antigo_fkey" FOREIGN KEY ("cpf_entregador_antigo") REFERENCES "Entregador"("cpf") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricoPedidoEntregadores" ADD CONSTRAINT "HistoricoPedidoEntregadores_cpf_entregador_novo_fkey" FOREIGN KEY ("cpf_entregador_novo") REFERENCES "Entregador"("cpf") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contrato" ADD CONSTRAINT "Contrato_cpf_entregador_fkey" FOREIGN KEY ("cpf_entregador") REFERENCES "Entregador"("cpf") ON DELETE RESTRICT ON UPDATE CASCADE;
