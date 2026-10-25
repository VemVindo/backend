import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { DashboardReqDto } from './dto/dashboard.dto';

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

  async totalPedidos(): Promise<number> {
    const resultado = await this.prisma.pedido.findMany({
      where: {
        idEmpresa: this.idEmpresa,
        ...((this.dataInicio || this.dataFinal) && {
          data_criacao: {
            ...(this.dataInicio && { gte: this.dataInicio }),
            ...(this.dataFinal && { lte: this.dataFinal }),
          },
        }),
      },
    });
    return resultado.length;
  }

  async totalPedidosPendentes(): Promise<number> {
    const resultado = await this.prisma.pedido.findMany({
      where: {
        idEmpresa: this.idEmpresa,
        status: 'PENDENTE',
        ...((this.dataInicio || this.dataFinal) && {
          data_criacao: {
            ...(this.dataInicio && { gte: this.dataInicio }),
            ...(this.dataFinal && { lte: this.dataFinal }),
          },
        }),
      },
    });
    return resultado.length;
  }

  async totalPedidosAndamento(): Promise<number> {
    const resultado = await this.prisma.pedido.findMany({
      where: {
        idEmpresa: this.idEmpresa,
        status: 'EM_ANDAMENTO',
        ...((this.dataInicio || this.dataFinal) && {
          data_criacao: {
            ...(this.dataInicio && { gte: this.dataInicio }),
            ...(this.dataFinal && { lte: this.dataFinal }),
          },
        }),
      },
    });
    return resultado.length;
  }

  async totalPedidosConcluidos(): Promise<number> {
    const resultado = await this.prisma.pedido.findMany({
      where: {
        idEmpresa: this.idEmpresa,
        status: 'FINALIZADO',
        ...((this.dataInicio || this.dataFinal) && {
          data_criacao: {
            ...(this.dataInicio && { gte: this.dataInicio }),
            ...(this.dataFinal && { lte: this.dataFinal }),
          },
        }),
      },
    });
    return resultado.length;
  }
  async totalPedidosCancelados(): Promise<number> {
    const resultado = await this.prisma.pedido.findMany({
      where: {
        idEmpresa: this.idEmpresa,
        status: 'CANCELADO',
        ...((this.dataInicio || this.dataFinal) && {
          data_criacao: {
            ...(this.dataInicio && { gte: this.dataInicio }),
            ...(this.dataFinal && { lte: this.dataFinal }),
          },
        }),
      },
    });
    return resultado.length;
  }

  mediaAvaliacoes() {}

  tempoMedioEntrega() {}

  totalDistanciaPercorrida() {}

  pedidosPorEntregador() {}
}
