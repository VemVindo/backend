import { Injectable } from '@nestjs/common';
import { Avaliacao, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface FiltroDeAvaliacoes {
  notas?: number[];
  de?: Date;
  ate?: Date;
}

export type AvaliacaoComEntrega = Avaliacao & {
  pedido: { id_pedido: number; entregador: { nome: string } | null };
};

export const LIMITE_DA_LISTA = 200;

@Injectable()
export class AvaliacaoRepository {
  constructor(private readonly prisma: PrismaService) {}

  procurar(idPedido: number): Promise<Avaliacao | null> {
    return this.prisma.avaliacao.findUnique({ where: { idpedidos: idPedido } });
  }

  criar(idPedido: number, nota: number, data: Date): Promise<Avaliacao> {
    return this.prisma.avaliacao.create({
      data: { idpedidos: idPedido, avaliacao_entrega: nota, data },
    });
  }

  async registrarComentario(
    idPedido: number,
    comentario: string,
  ): Promise<boolean> {
    const { count } = await this.prisma.avaliacao.updateMany({
      where: { idpedidos: idPedido, comentario: null },
      data: { comentario },
    });
    return count > 0;
  }

  listarDaEmpresa(
    idEmpresa: number,
    filtro: FiltroDeAvaliacoes,
  ): Promise<AvaliacaoComEntrega[]> {
    const data: Prisma.DateTimeFilter = {};
    if (filtro.de) data.gte = filtro.de;
    if (filtro.ate) data.lte = filtro.ate;
    return this.prisma.avaliacao.findMany({
      where: {
        pedido: { idEmpresa },
        ...(filtro.notas?.length
          ? { avaliacao_entrega: { in: filtro.notas } }
          : {}),
        ...(filtro.de || filtro.ate ? { data } : {}),
      },
      include: {
        pedido: {
          select: { id_pedido: true, entregador: { select: { nome: true } } },
        },
      },
      orderBy: { data: 'desc' },
      take: LIMITE_DA_LISTA,
    });
  }
}
