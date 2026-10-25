-- Extensoes nullable: nenhum valor legado e recalculado ou inferido.
ALTER TABLE "Pedido"
ADD COLUMN "ganho_consolidado_centavos" INTEGER,
ADD COLUMN "taxa_fixa_atribuicao_centavos" INTEGER,
ADD COLUMN "coeficiente_atribuicao_centavos_km" INTEGER,
ADD COLUMN "parametros_vigentes_desde" TIMESTAMPTZ(3),
ADD COLUMN "remuneracao_atribuida_em" TIMESTAMPTZ(3),
ADD COLUMN "distancia_conhecida" BOOLEAN;

ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_ganho_consolidado_valido" CHECK (
  "ganho_consolidado_centavos" IS NULL OR (
    "ganho_consolidado_centavos" >= 0
    AND "status" = 'FINALIZADO'
    AND "data_finalizacao" IS NOT NULL
    AND "cpf_entregador" IS NOT NULL
    AND "distancia_conhecida" IS TRUE
    AND "distancia" >= 0
    AND "taxa_fixa_atribuicao_centavos" IS NOT NULL
    AND "taxa_fixa_atribuicao_centavos" >= 0
    AND "coeficiente_atribuicao_centavos_km" IS NOT NULL
    AND "coeficiente_atribuicao_centavos_km" >= 0
    AND "parametros_vigentes_desde" IS NOT NULL
    AND "remuneracao_atribuida_em" IS NOT NULL
  )
);
