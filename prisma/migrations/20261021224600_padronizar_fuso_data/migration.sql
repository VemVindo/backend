-- O Prisma grava DateTime em UTC, entao os timestamps sem fuso existentes
-- estao em UTC. Converte-os para instantes sem deslocar o horario.
ALTER TABLE "Entregador"
    ALTER COLUMN "ciencia_dados_em" TYPE TIMESTAMPTZ(3)
        USING "ciencia_dados_em" AT TIME ZONE 'UTC',
    ALTER COLUMN "senha_temporaria_expira_em" TYPE TIMESTAMPTZ(3)
        USING "senha_temporaria_expira_em" AT TIME ZONE 'UTC';

ALTER TABLE "Pedido"
    ALTER COLUMN "data_criacao" TYPE TIMESTAMPTZ(3)
        USING "data_criacao" AT TIME ZONE 'UTC',
    ALTER COLUMN "data_inicio_entrega" TYPE TIMESTAMPTZ(3)
        USING "data_inicio_entrega" AT TIME ZONE 'UTC',
    ALTER COLUMN "data_finalizacao" TYPE TIMESTAMPTZ(3)
        USING "data_finalizacao" AT TIME ZONE 'UTC';

ALTER TABLE "MetricasPagamento"
    ALTER COLUMN "data" TYPE TIMESTAMPTZ(3)
        USING "data" AT TIME ZONE 'UTC';

ALTER TABLE "HistoricoPedidoEntregadores"
    ALTER COLUMN "data" TYPE TIMESTAMPTZ(3)
        USING "data" AT TIME ZONE 'UTC';

ALTER TABLE "Contrato"
    ALTER COLUMN "data_inicio" TYPE TIMESTAMPTZ(3)
        USING "data_inicio" AT TIME ZONE 'UTC',
    ALTER COLUMN "data_aceite" TYPE TIMESTAMPTZ(3)
        USING "data_aceite" AT TIME ZONE 'UTC',
    ALTER COLUMN "data_fim" TYPE TIMESTAMPTZ(3)
        USING "data_fim" AT TIME ZONE 'UTC';

ALTER TABLE "AcessoRecebedor"
    ALTER COLUMN "data_criacao" TYPE TIMESTAMPTZ(3)
        USING "data_criacao" AT TIME ZONE 'UTC';

ALTER TABLE "LocalizacaoEntrega"
    ALTER COLUMN "registrada_em" TYPE TIMESTAMPTZ(3)
        USING "registrada_em" AT TIME ZONE 'UTC',
    ALTER COLUMN "rota_calculada_em" TYPE TIMESTAMPTZ(3)
        USING "rota_calculada_em" AT TIME ZONE 'UTC';

ALTER TABLE "CredencialIntegracao"
    ALTER COLUMN "data_criacao" TYPE TIMESTAMPTZ(3)
        USING "data_criacao" AT TIME ZONE 'UTC',
    ALTER COLUMN "data_revogacao" TYPE TIMESTAMPTZ(3)
        USING "data_revogacao" AT TIME ZONE 'UTC',
    ALTER COLUMN "ultimo_uso" TYPE TIMESTAMPTZ(3)
        USING "ultimo_uso" AT TIME ZONE 'UTC';

ALTER TABLE "PedidoImportado"
    ALTER COLUMN "data_recebimento" TYPE TIMESTAMPTZ(3)
        USING "data_recebimento" AT TIME ZONE 'UTC';
