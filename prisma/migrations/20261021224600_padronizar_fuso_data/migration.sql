-- Os timestamps sem fuso existentes representam horario local de Sao Paulo.
-- Converte-os para instantes sem alterar o horario que os usuarios veem.
ALTER TABLE "Entregador"
    ALTER COLUMN "ciencia_dados_em" TYPE TIMESTAMPTZ(3)
        USING "ciencia_dados_em" AT TIME ZONE 'America/Sao_Paulo',
    ALTER COLUMN "senha_temporaria_expira_em" TYPE TIMESTAMPTZ(3)
        USING "senha_temporaria_expira_em" AT TIME ZONE 'America/Sao_Paulo';

ALTER TABLE "Pedido"
    ALTER COLUMN "data_criacao" TYPE TIMESTAMPTZ(3)
        USING "data_criacao" AT TIME ZONE 'America/Sao_Paulo',
    ALTER COLUMN "data_inicio_entrega" TYPE TIMESTAMPTZ(3)
        USING "data_inicio_entrega" AT TIME ZONE 'America/Sao_Paulo',
    ALTER COLUMN "data_finalizacao" TYPE TIMESTAMPTZ(3)
        USING "data_finalizacao" AT TIME ZONE 'America/Sao_Paulo';

ALTER TABLE "MetricasPagamento"
    ALTER COLUMN "data" TYPE TIMESTAMPTZ(3)
        USING "data" AT TIME ZONE 'America/Sao_Paulo';

ALTER TABLE "HistoricoPedidoEntregadores"
    ALTER COLUMN "data" TYPE TIMESTAMPTZ(3)
        USING "data" AT TIME ZONE 'America/Sao_Paulo';

ALTER TABLE "Contrato"
    ALTER COLUMN "data_inicio" TYPE TIMESTAMPTZ(3)
        USING "data_inicio" AT TIME ZONE 'America/Sao_Paulo',
    ALTER COLUMN "data_aceite" TYPE TIMESTAMPTZ(3)
        USING "data_aceite" AT TIME ZONE 'America/Sao_Paulo',
    ALTER COLUMN "data_fim" TYPE TIMESTAMPTZ(3)
        USING "data_fim" AT TIME ZONE 'America/Sao_Paulo';

ALTER TABLE "AcessoRecebedor"
    ALTER COLUMN "data_criacao" TYPE TIMESTAMPTZ(3)
        USING "data_criacao" AT TIME ZONE 'America/Sao_Paulo';

ALTER TABLE "LocalizacaoEntrega"
    ALTER COLUMN "registrada_em" TYPE TIMESTAMPTZ(3)
        USING "registrada_em" AT TIME ZONE 'America/Sao_Paulo',
    ALTER COLUMN "rota_calculada_em" TYPE TIMESTAMPTZ(3)
        USING "rota_calculada_em" AT TIME ZONE 'America/Sao_Paulo';

ALTER TABLE "CredencialIntegracao"
    ALTER COLUMN "data_criacao" TYPE TIMESTAMPTZ(3)
        USING "data_criacao" AT TIME ZONE 'America/Sao_Paulo',
    ALTER COLUMN "data_revogacao" TYPE TIMESTAMPTZ(3)
        USING "data_revogacao" AT TIME ZONE 'America/Sao_Paulo',
    ALTER COLUMN "ultimo_uso" TYPE TIMESTAMPTZ(3)
        USING "ultimo_uso" AT TIME ZONE 'America/Sao_Paulo';

ALTER TABLE "PedidoImportado"
    ALTER COLUMN "data_recebimento" TYPE TIMESTAMPTZ(3)
        USING "data_recebimento" AT TIME ZONE 'America/Sao_Paulo';
