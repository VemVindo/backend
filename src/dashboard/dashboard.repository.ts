import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { StatusContrato, StatusPedido } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';

export interface FiltroDoDashboard {
  idEmpresa: number;
  dataInicio?: Date;
  dataFinal?: Date;
}

export interface DuracaoDaEntrega {
  data_inicio_entrega: Date | null;
  data_finalizacao: Date | null;
}

export interface EntregadorComPedidos {
  cpf: string;
  nome: string;
  pedidos: { status: StatusPedido; valor_entrega: number }[];
}

// Cada status entra no periodo pela data da etapa que ele representa. O pedido
// cancelado nao guarda a data do cancelamento, entao entra pela criacao.
const DATA_DA_ETAPA: Record<StatusPedido, string> = {
  [StatusPedido.PENDENTE]: 'data_criacao',
  [StatusPedido.EM_ANDAMENTO]: 'data_inicio_entrega',
  [StatusPedido.FINALIZADO]: 'data_finalizacao',
  [StatusPedido.CANCELADO]: 'data_criacao',
};

function filtroDePeriodo(
  campoData: string,
  { dataInicio, dataFinal }: FiltroDoDashboard,
) {
  if (!dataInicio && !dataFinal) return {};
  return { [campoData]: { gte: dataInicio, lte: dataFinal } };
}

function entregasConcluidas(
  filtro: FiltroDoDashboard,
): Prisma.PedidoWhereInput {
  return {
    idEmpresa: filtro.idEmpresa,
    status: StatusPedido.FINALIZADO,
    data_inicio_entrega: { not: null },
    data_finalizacao: { not: null },
    ...filtroDePeriodo('data_finalizacao', filtro),
  };
}

@Injectable()
export class DashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  contarPedidos(
    filtro: FiltroDoDashboard,
    status?: StatusPedido,
  ): Promise<number> {
    const campoData = status ? DATA_DA_ETAPA[status] : 'data_criacao';
    return this.prisma.pedido.count({
      where: {
        idEmpresa: filtro.idEmpresa,
        status,
        ...filtroDePeriodo(campoData, filtro),
      },
    });
  }

  async mediaDasAvaliacoes(filtro: FiltroDoDashboard): Promise<number | null> {
    const { _avg: media } = await this.prisma.avaliacao.aggregate({
      where: {
        pedido: { idEmpresa: filtro.idEmpresa },
        ...filtroDePeriodo('data', filtro),
      },
      _avg: { avaliacao_entrega: true },
    });
    return media.avaliacao_entrega;
  }

  listarDuracoesDeEntrega(
    filtro: FiltroDoDashboard,
  ): Promise<DuracaoDaEntrega[]> {
    return this.prisma.pedido.findMany({
      where: entregasConcluidas(filtro),
      select: { data_inicio_entrega: true, data_finalizacao: true },
    });
  }

  async somarDistanciaPercorrida(filtro: FiltroDoDashboard): Promise<number> {
    const { _sum: soma } = await this.prisma.pedido.aggregate({
      where: entregasConcluidas(filtro),
      _sum: { distancia: true },
    });
    return soma.distancia ?? 0;
  }

  listarEntregadoresAtivos(
    filtro: FiltroDoDashboard,
  ): Promise<EntregadorComPedidos[]> {
    return this.prisma.entregador.findMany({
      where: {
        contratos: {
          some: { status: StatusContrato.ATIVO, idEmpresa: filtro.idEmpresa },
        },
      },
      select: {
        cpf: true,
        nome: true,
        pedidos: {
          where: {
            idEmpresa: filtro.idEmpresa,
            OR: [
              {
                status: StatusPedido.EM_ANDAMENTO,
                ...filtroDePeriodo('data_inicio_entrega', filtro),
              },
              {
                status: StatusPedido.FINALIZADO,
                ...filtroDePeriodo('data_finalizacao', filtro),
              },
            ],
          },
          select: { status: true, valor_entrega: true },
        },
      },
    });
  }
}
