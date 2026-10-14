-- CreateTable
CREATE TABLE "AcessoRecebedor" (
    "idPedido" INTEGER NOT NULL,
    "token_hash" TEXT NOT NULL,
    "codigo_recebedor" TEXT NOT NULL,
    "data_criacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcessoRecebedor_pkey" PRIMARY KEY ("idPedido")
);

-- CreateIndex
CREATE UNIQUE INDEX "AcessoRecebedor_token_hash_key" ON "AcessoRecebedor"("token_hash");

-- AddForeignKey
ALTER TABLE "AcessoRecebedor" ADD CONSTRAINT "AcessoRecebedor_idPedido_fkey" FOREIGN KEY ("idPedido") REFERENCES "Pedido"("id_pedido") ON DELETE RESTRICT ON UPDATE CASCADE;
