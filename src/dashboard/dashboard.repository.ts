import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardReqDto } from './dto/dashboard.dto';
import { StatusPedido } from '../generated/prisma/enums';
import { Pedido } from '../generated/prisma';
import { EntregadorEPedidos } from './type/entregador-pedido.type';

@Injectable()
export class DashboardRepository {
  idEmpresa!: number;
  dataInicio: string | null = null;
  dataFinal: string | null = null;
  constructor(private readonly prisma: PrismaService) {}

  definirAtributos(idEmpresa: number, dashboardDto: DashboardReqDto) {
    this.idEmpresa = idEmpresa;
    this.dataInicio = dashboardDto.dataInicio;
    this.dataFinal = dashboardDto.dataFinal;
  }

  // Helper privado para gerar o filtro de data (trata os 4 cenários: vazio, gte, lte, gte+lte)
  private obterFiltroData(campoData: string) {
    if (!this.dataInicio && !this.dataFinal) return {};

    return {
      [campoData]: {
        ...(this.dataInicio && { gte: this.dataInicio }),
        ...(this.dataFinal && { lte: this.dataFinal }),
      },
    };
  }

  async totalPedidos(): Promise<Pedido[]> {
    const resultado = await this.prisma.pedido.findMany({
      where: {
        idEmpresa: this.idEmpresa,
        ...this.obterFiltroData('data_criacao'),
      },
    });
    return resultado;
  }

  async totalPedidosPendentes(): Promise<Pedido[]> {
    const resultado = await this.prisma.pedido.findMany({
      where: {
        idEmpresa: this.idEmpresa,
        status: StatusPedido.PENDENTE,
        ...this.obterFiltroData('data_criacao'),
      },
    });
    return resultado;
  }

  async totalPedidosAndamento(): Promise<Pedido[]> {
    const resultado = await this.prisma.pedido.findMany({
      where: {
        idEmpresa: this.idEmpresa,
        status: StatusPedido.EM_ANDAMENTO,
        ...this.obterFiltroData('data_inicio_entrega'),
      },
    });
    return resultado;
  }

  async totalPedidosConcluidos(): Promise<Pedido[]> {
    const resultado = await this.prisma.pedido.findMany({
      where: {
        idEmpresa: this.idEmpresa,
        status: StatusPedido.FINALIZADO,
        ...this.obterFiltroData('data_finalizacao'),
      },
    });
    return resultado;
  }

  async totalPedidosCancelados(): Promise<Pedido[]> {
    const resultado = await this.prisma.pedido.findMany({
      where: {
        idEmpresa: this.idEmpresa,
        status: StatusPedido.CANCELADO,
        ...this.obterFiltroData('data_cancelamento'),
      },
    });
    return resultado;
  }

  async avaliacoes(): Promise<{ avaliacao_entrega: number }[]> {
    const resultado = await this.prisma.avaliacao.findMany({
      where: {
        ...this.obterFiltroData('data'),
        pedido: {
          idEmpresa: this.idEmpresa,
        },
      },
      select: {
        avaliacao_entrega: true,
      },
    });

    return resultado;
  }

  async tempoMedioEntrega(): Promise<
    {
      data_inicio_entrega: Date | null;
      data_finalizacao: Date | null;
    }[]
  > {
    const resultado = await this.prisma.pedido.findMany({
      where: {
        idEmpresa: this.idEmpresa,
        status: StatusPedido.FINALIZADO,
        data_inicio_entrega: { not: null },
        data_finalizacao: { not: null },
        ...this.obterFiltroData('data_finalizacao'),
      },
      select: {
        data_inicio_entrega: true,
        data_finalizacao: true,
      },
    });
    return resultado;
  }

  async totalDistanciaPercorrida(): Promise<{ distancia: number }[]> {
    const resultado = await this.prisma.pedido.findMany({
      where: {
        idEmpresa: this.idEmpresa,
        status: StatusPedido.FINALIZADO,
        data_inicio_entrega: { not: null },
        data_finalizacao: { not: null },
        ...this.obterFiltroData('data_finalizacao'),
      },
      select: {
        distancia: true,
      },
    });
    return resultado;
  }

  async relatorioPorEntregador(): Promise<EntregadorEPedidos[]> {
    // Monta o filtro de data condicional para o relatório por entregador
    const filtroDataPedido =
      this.dataInicio || this.dataFinal
        ? {
            OR: [
              {
                status: StatusPedido.EM_ANDAMENTO,
                data_inicio_entrega: {
                  ...(this.dataInicio && { gte: this.dataInicio }),
                  ...(this.dataFinal && { lte: this.dataFinal }),
                },
              },
              {
                status: StatusPedido.FINALIZADO,
                data_finalizacao: {
                  ...(this.dataInicio && { gte: this.dataInicio }),
                  ...(this.dataFinal && { lte: this.dataFinal }),
                },
              },
            ],
          }
        : {};

    const entregadores = await this.prisma.entregador.findMany({
      where: {
        contratos: {
          some: {
            status: 'ATIVO',
            idEmpresa: this.idEmpresa,
          },
        },
      },
      include: {
        pedidos: {
          where: {
            idEmpresa: this.idEmpresa,
            status: {
              in: [StatusPedido.EM_ANDAMENTO, StatusPedido.FINALIZADO],
            },
            ...filtroDataPedido,
          },
          select: {
            status: true,
            valor_entrega: true,
            data_inicio_entrega: true,
            data_finalizacao: true,
          },
        },
      },
    });

    return entregadores;
  }
}
