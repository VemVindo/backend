-- AlterTable
ALTER TABLE "Empresa" ADD COLUMN     "exibir_mapa" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN     "destino_lat" DOUBLE PRECISION,
ADD COLUMN     "destino_lng" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "LocalizacaoEntrega" (
    "idPedido" INTEGER NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "precisao_m" DOUBLE PRECISION,
    "registrada_em" TIMESTAMP(3) NOT NULL,
    "origem_rota_lat" DOUBLE PRECISION,
    "origem_rota_lng" DOUBLE PRECISION,
    "rota_polyline" TEXT,
    "distancia_restante_m" INTEGER,
    "duracao_restante_s" INTEGER,
    "estimado" BOOLEAN NOT NULL DEFAULT true,
    "rota_calculada_em" TIMESTAMP(3),

    CONSTRAINT "LocalizacaoEntrega_pkey" PRIMARY KEY ("idPedido")
);

-- AddForeignKey
ALTER TABLE "LocalizacaoEntrega" ADD CONSTRAINT "LocalizacaoEntrega_idPedido_fkey" FOREIGN KEY ("idPedido") REFERENCES "Pedido"("id_pedido") ON DELETE CASCADE ON UPDATE CASCADE;
