-- CreateTable
CREATE TABLE "CredencialIntegracao" (
    "id_credencial" SERIAL NOT NULL,
    "idEmpresa" INTEGER NOT NULL,
    "prefixo" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "data_criacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_revogacao" TIMESTAMP(3),
    "ultimo_uso" TIMESTAMP(3),

    CONSTRAINT "CredencialIntegracao_pkey" PRIMARY KEY ("id_credencial")
);

-- CreateIndex
CREATE UNIQUE INDEX "CredencialIntegracao_prefixo_key" ON "CredencialIntegracao"("prefixo");

-- CreateIndex
CREATE UNIQUE INDEX "CredencialIntegracao_ativa_key" ON "CredencialIntegracao"("idEmpresa") WHERE ("data_revogacao" IS NULL);

-- AddForeignKey
ALTER TABLE "CredencialIntegracao" ADD CONSTRAINT "CredencialIntegracao_idEmpresa_fkey" FOREIGN KEY ("idEmpresa") REFERENCES "Empresa"("id_empresa") ON DELETE RESTRICT ON UPDATE CASCADE;
