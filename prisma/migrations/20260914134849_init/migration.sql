-- CreateTable
CREATE TABLE "Empresa" (
    "id_empresa" SERIAL NOT NULL,
    "nome_fantasia" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "CNPJ" TEXT,
    "cpf" TEXT,
    "cep" TEXT NOT NULL,
    "logradouro" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "complemento" TEXT,
    "bairro" TEXT NOT NULL,
    "cidade" TEXT NOT NULL,
    "UF" TEXT NOT NULL,
    "razao_social" TEXT,
    "senha" TEXT NOT NULL,

    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id_empresa")
);

-- CreateTable
CREATE TABLE "Entregador" (
    "id_entregador" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "is_online" BOOLEAN NOT NULL,
    "telefone" TEXT NOT NULL,
    "tipo_veiculo" TEXT NOT NULL,
    "placa" TEXT NOT NULL,
    "senha" TEXT NOT NULL,

    CONSTRAINT "Entregador_pkey" PRIMARY KEY ("id_entregador")
);

-- CreateTable
CREATE TABLE "Pedido" (
    "id_pedido" SERIAL NOT NULL,
    "nome_reccebedor" TEXT NOT NULL,
    "telefone_recebedor" TEXT NOT NULL,
    "cep" TEXT NOT NULL,
    "logradouro" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "complemento" TEXT NOT NULL,
    "bairro" TEXT NOT NULL,
    "cidade" TEXT NOT NULL,
    "uf" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "data_criacao" TIMESTAMP(3) NOT NULL,
    "data_inicio_entrega" TIMESTAMP(3),
    "data_finalizacao" TIMESTAMP(3),
    "valor_entrega" INTEGER NOT NULL,
    "idEmpresa" INTEGER NOT NULL,
    "identregadores" INTEGER NOT NULL,
    "distancia" INTEGER NOT NULL,

    CONSTRAINT "Pedido_pkey" PRIMARY KEY ("id_pedido")
);

-- CreateTable
CREATE TABLE "MetricasPagamento" (
    "idEmpresa" INTEGER NOT NULL,
    "taxa_fixa" INTEGER NOT NULL,
    "coeficiente" INTEGER NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetricasPagamento_pkey" PRIMARY KEY ("idEmpresa","data")
);

-- CreateTable
CREATE TABLE "Avaliacao" (
    "idpedidos" INTEGER NOT NULL,
    "avaliacao_entrega" INTEGER NOT NULL,
    "comentario" TEXT NOT NULL,

    CONSTRAINT "Avaliacao_pkey" PRIMARY KEY ("idpedidos")
);

-- CreateTable
CREATE TABLE "HistoricoPedidoEntregadores" (
    "id_historico" SERIAL NOT NULL,
    "id_pedido" INTEGER NOT NULL,
    "id_entregador_antigo" INTEGER NOT NULL,
    "id_entregador_novo" INTEGER NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HistoricoPedidoEntregadores_pkey" PRIMARY KEY ("id_historico")
);

-- CreateTable
CREATE TABLE "Contrato" (
    "id_contrato" SERIAL NOT NULL,
    "idEmpresa" INTEGER NOT NULL,
    "identregadores" INTEGER NOT NULL,
    "data_inicio" TIMESTAMP(3) NOT NULL,
    "data_fim" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contrato_pkey" PRIMARY KEY ("id_contrato")
);

-- CreateIndex
CREATE UNIQUE INDEX "Empresa_email_key" ON "Empresa"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Empresa_CNPJ_key" ON "Empresa"("CNPJ");

-- CreateIndex
CREATE UNIQUE INDEX "Empresa_cpf_key" ON "Empresa"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "Entregador_cpf_key" ON "Entregador"("cpf");

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_idEmpresa_fkey" FOREIGN KEY ("idEmpresa") REFERENCES "Empresa"("id_empresa") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_identregadores_fkey" FOREIGN KEY ("identregadores") REFERENCES "Entregador"("id_entregador") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetricasPagamento" ADD CONSTRAINT "MetricasPagamento_idEmpresa_fkey" FOREIGN KEY ("idEmpresa") REFERENCES "Empresa"("id_empresa") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Avaliacao" ADD CONSTRAINT "Avaliacao_idpedidos_fkey" FOREIGN KEY ("idpedidos") REFERENCES "Pedido"("id_pedido") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricoPedidoEntregadores" ADD CONSTRAINT "HistoricoPedidoEntregadores_id_pedido_fkey" FOREIGN KEY ("id_pedido") REFERENCES "Pedido"("id_pedido") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricoPedidoEntregadores" ADD CONSTRAINT "HistoricoPedidoEntregadores_id_entregador_antigo_fkey" FOREIGN KEY ("id_entregador_antigo") REFERENCES "Entregador"("id_entregador") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricoPedidoEntregadores" ADD CONSTRAINT "HistoricoPedidoEntregadores_id_entregador_novo_fkey" FOREIGN KEY ("id_entregador_novo") REFERENCES "Entregador"("id_entregador") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contrato" ADD CONSTRAINT "Contrato_idEmpresa_fkey" FOREIGN KEY ("idEmpresa") REFERENCES "Empresa"("id_empresa") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contrato" ADD CONSTRAINT "Contrato_identregadores_fkey" FOREIGN KEY ("identregadores") REFERENCES "Entregador"("id_entregador") ON DELETE RESTRICT ON UPDATE CASCADE;
