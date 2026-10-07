import { Injectable } from '@nestjs/common';
import { Pedido } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StatusPedido } from '../common/enums/status-pedido.enum';

@Injectable()
export class PedidoRepository {
  constructor(private readonly prisma: PrismaService) { }

  procurarPorEmpresa(
    idPedido: number,
    idEmpresa: number,
  ): Promise<Pedido | null> {
    return this.prisma.pedido.findFirst({
      where: {
        id_pedido: idPedido,
        idEmpresa,
      },
    });
  }

  procurarAtribuidoAoEntregador(
    idPedido: number,
    cpfEntregador: string,
  ): Promise<Pedido | null> {
    return this.prisma.pedido.findFirst({
      where: {
        id_pedido: idPedido,
        cpf_entregador: cpfEntregador,
      },
    });
  }

  atualizarStatus(
    idPedido: number,
    novoStatus: StatusPedido,
  ): Promise<Pedido> {
    return this.prisma.pedido.update({
      where: {
        id_pedido: idPedido,
      },
      data: {
        status: novoStatus,
      },
    });
  }
}