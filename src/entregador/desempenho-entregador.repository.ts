import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { StatusContrato } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { IndicadoresDesempenho } from './dto/desempenho-entregador.dto';

type IndicadoresDoBanco = {
  [campoIndicador in keyof IndicadoresDesempenho]:
    IndicadoresDesempenho[campoIndicador] | bigint;
};

@Injectable()
export class RepositorioDesempenhoEntregador {
  constructor(private readonly clientePrisma: PrismaService) {}

  agregarDesempenho(
    idEmpresa: number,
    cpfEntregador: string,
    dataInicioPeriodo: Date,
    dataFimPeriodo: Date,
  ): Promise<IndicadoresDesempenho | null> {
    return this.clientePrisma.$transaction(
      async (clienteTransacional) => {
        const entregadorVinculado =
          await clienteTransacional.entregador.findFirst({
            where: {
              cpf: cpfEntregador,
              contratos: {
                some: { idEmpresa, status: StatusContrato.ATIVO },
              },
            },
            select: { cpf: true },
          });
        if (!entregadorVinculado) return null;
        const [indicadoresDesempenho] = await clienteTransacional.$queryRaw<
          IndicadoresDoBanco[]
        >(
          montarConsultaDesempenho(
            idEmpresa,
            cpfEntregador,
            dataInicioPeriodo,
            dataFimPeriodo,
          ),
        );
        return normalizarIndicadores(indicadoresDesempenho);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}

const AGREGACAO_DESEMPENHO = Prisma.sql`
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

function montarConsultaDesempenho(
  idEmpresa: number,
  cpfEntregador: string,
  dataInicioPeriodo: Date,
  dataFimPeriodo: Date,
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
    WHERE pedido."idEmpresa" = ${idEmpresa}
      AND pedido.cpf_entregador = ${cpfEntregador}
      AND pedido.status = 'FINALIZADO'
      AND pedido.data_finalizacao >= ${dataInicioPeriodo}
      AND pedido.data_finalizacao < ${dataFimPeriodo}
  )
  ${AGREGACAO_DESEMPENHO}`;
}

function normalizarIndicadores(
  indicadoresDesempenho: IndicadoresDoBanco,
): IndicadoresDesempenho {
  return Object.fromEntries(
    Object.entries(indicadoresDesempenho).map(
      ([campoIndicador, valorIndicador]) => {
        if (typeof valorIndicador !== 'bigint')
          return [campoIndicador, valorIndicador];
        const inteiroIndicador = Number(valorIndicador);
        if (!Number.isSafeInteger(inteiroIndicador)) {
          throw new RangeError('Indicador excede o limite numerico seguro');
        }
        return [campoIndicador, inteiroIndicador];
      },
    ),
  ) as IndicadoresDesempenho;
}
