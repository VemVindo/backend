CREATE TYPE "SituacaoImportacao" AS ENUM ('AGUARDANDO_COMPLETUDE', 'CONVERTIDO');

CREATE TABLE "PedidoImportado" (
    "id_importacao" SERIAL NOT NULL,
    "idEmpresa" INTEGER NOT NULL,
    "id_externo" TEXT NOT NULL,
    "dados" JSONB NOT NULL,
    "campos_faltantes" TEXT[],
    "situacao" "SituacaoImportacao" NOT NULL DEFAULT 'AGUARDANDO_COMPLETUDE',
    "idPedido" INTEGER,
    "data_recebimento" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PedidoImportado_pkey" PRIMARY KEY ("id_importacao")
);

CREATE UNIQUE INDEX "PedidoImportado_idPedido_key" ON "PedidoImportado"("idPedido");

CREATE UNIQUE INDEX "PedidoImportado_idEmpresa_id_externo_key" ON "PedidoImportado"("idEmpresa", "id_externo");

ALTER TABLE "PedidoImportado" ADD CONSTRAINT "PedidoImportado_idEmpresa_fkey" FOREIGN KEY ("idEmpresa") REFERENCES "Empresa"("id_empresa") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PedidoImportado" ADD CONSTRAINT "PedidoImportado_idPedido_fkey" FOREIGN KEY ("idPedido") REFERENCES "Pedido"("id_pedido") ON DELETE SET NULL ON UPDATE CASCADE;
