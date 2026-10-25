import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { StatusContrato } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { IndicadoresDesempenho } from './dto/desempenho-entregador.dto';

type IndicadoresDoBanco = {
  [campo_indicador in keyof IndicadoresDesempenho]:
    IndicadoresDesempenho[campo_indicador] | bigint;
};

@Injectable()
export class RepositorioDesempenhoEntregador {
  constructor(private readonly cliente_prisma: PrismaService) {}

  agregar_desempenho(
    id_empresa: number,
    cpf_entregador: string,
    data_inicio_periodo: Date,
    data_fim_periodo: Date,
  ): Promise<IndicadoresDesempenho | null> {
    return this.cliente_prisma.$transaction(
      async (cliente_transacional) => {
        const entregador_vinculado =
          await cliente_transacional.entregador.findFirst({
            where: {
              cpf: cpf_entregador,
              contratos: {
                some: { idEmpresa: id_empresa, status: StatusContrato.ATIVO },
              },
            },
            select: { cpf: true },
          });
        if (!entregador_vinculado) return null;
        const [indicadores_desempenho] = await cliente_transacional.$queryRaw<
          IndicadoresDoBanco[]
        >(
          montar_consulta_desempenho(
            id_empresa,
            cpf_entregador,
            data_inicio_periodo,
            data_fim_periodo,
          ),
        );
        return normalizar_indicadores(indicadores_desempenho);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}

function montar_consulta_desempenho(
  id_empresa: number,
  cpf_entregador: string,
  data_inicio_periodo: Date,
  data_fim_periodo: Date,
): Prisma.Sql {
  return Prisma.sql`
  WITH entregas AS (
    SELECT pedido.id_pedido, pedido.distancia, pedido.distancia_conhecida,
      CASE
        WHEN atribuicao.cpf_entregador_novo = pedido.cpf_entregador
          AND atribuicao.data >= pedido.data_criacao
          AND atribuicao.data <= pedido.data_finalizacao
        THEN EXTRACT(EPOCH FROM (pedido.data_finalizacao - atribuicao.data))::double precision
      END AS tempo_segundos
    FROM "Pedido" pedido
    LEFT JOIN LATERAL (
      SELECT historico.data, historico.cpf_entregador_novo
      FROM "HistoricoPedidoEntregadores" historico
      WHERE historico.id_pedido = pedido.id_pedido
      ORDER BY historico.data DESC, historico.id_historico DESC
      LIMIT 1
    ) atribuicao ON TRUE
    WHERE pedido."idEmpresa" = ${id_empresa}
      AND pedido.cpf_entregador = ${cpf_entregador}
      AND pedido.status = 'FINALIZADO'
      AND pedido.data_finalizacao >= ${data_inicio_periodo}
      AND pedido.data_finalizacao < ${data_fim_periodo}
  )
  SELECT COUNT(*) AS total_entregas,
    AVG(entregas.tempo_segundos)::double precision AS tempo_medio_entrega_segundos,
    COUNT(entregas.tempo_segundos) AS entregas_com_tempo_valido,
    COUNT(*) FILTER (WHERE entregas.tempo_segundos IS NULL) AS entregas_sem_tempo_valido,
    AVG(avaliacao.avaliacao_entrega) FILTER (
      WHERE avaliacao.avaliacao_entrega BETWEEN 0 AND 5
    )::double precision AS avaliacao_media,
    COUNT(*) FILTER (
      WHERE avaliacao.avaliacao_entrega BETWEEN 0 AND 5
    ) AS total_avaliacoes,
    CASE WHEN COUNT(*) FILTER (WHERE entregas.distancia_conhecida IS NOT TRUE) = 0
      THEN COALESCE(SUM(entregas.distancia) FILTER (WHERE entregas.distancia_conhecida IS TRUE), 0)
    END AS distancia_total_metros,
    CASE WHEN COUNT(*) = 0 THEN 0
      ELSE SUM(entregas.distancia) FILTER (WHERE entregas.distancia_conhecida IS TRUE)
    END AS distancia_conhecida_metros,
    COUNT(*) FILTER (WHERE entregas.distancia_conhecida IS TRUE) AS entregas_com_distancia_conhecida,
    COUNT(*) FILTER (WHERE entregas.distancia_conhecida IS NOT TRUE) AS entregas_com_distancia_desconhecida
  FROM entregas
  LEFT JOIN "Avaliacao" avaliacao ON avaliacao.idpedidos = entregas.id_pedido
`;
}

function normalizar_indicadores(
  indicadores_desempenho: IndicadoresDoBanco,
): IndicadoresDesempenho {
  return Object.fromEntries(
    Object.entries(indicadores_desempenho).map(
      ([campo_indicador, valor_indicador]) => {
        if (typeof valor_indicador !== 'bigint')
          return [campo_indicador, valor_indicador];
        const inteiro_indicador = Number(valor_indicador);
        if (!Number.isSafeInteger(inteiro_indicador)) {
          throw new RangeError('Indicador excede o limite numerico seguro');
        }
        return [campo_indicador, inteiro_indicador];
      },
    ),
  ) as IndicadoresDesempenho;
}
