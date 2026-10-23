ALTER TABLE "AcessoRecebedor" ADD COLUMN     "tentativas_codigo" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ultima_tentativa_codigo" TIMESTAMP(3);
