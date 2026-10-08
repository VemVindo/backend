import { Injectable } from '@nestjs/common';
import { Pedido } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type PedidoComEmpresa = Pedido & {
  empresa: { nome_fantasia: string };
};

@Injectable()
export class PedidoRepository {
  constructor(private readonly prisma: PrismaService) {}

  listarDoEntregador(cpfEntregador: string): Promise<PedidoComEmpresa[]> {
    return this.prisma.pedido.findMany({
      where: { cpf_entregador: cpfEntregador },
      include: { empresa: { select: { nome_fantasia: true } } },
      orderBy: { data_criacao: 'desc' },
    });
  }
}
