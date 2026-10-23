import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AcessoRecebedor, Pedido } from '../generated/prisma/client';

export type AcessoComPedido = AcessoRecebedor & {
  pedido: Pedido & {
    empresa: { nome_fantasia: string; exibir_mapa: boolean; telefone: string };
    entregador: { nome: string } | null;
  };
};

@Injectable()
export class RastreioRepository {
  constructor(private readonly prisma: PrismaService) {}

  salvarAcesso(
    idPedido: number,
    tokenHash: string,
    codigoRecebedor: string,
  ): Promise<AcessoRecebedor> {
    return this.prisma.acessoRecebedor.upsert({
      where: { idPedido },
      create: {
        idPedido,
        token_hash: tokenHash,
        codigo_recebedor: codigoRecebedor,
      },
      update: { token_hash: tokenHash },
    });
  }

  procurarPorTokenHash(tokenHash: string): Promise<AcessoComPedido | null> {
    return this.prisma.acessoRecebedor.findUnique({
      where: { token_hash: tokenHash },
      include: {
        pedido: {
          include: {
            empresa: {
              select: {
                nome_fantasia: true,
                exibir_mapa: true,
                telefone: true,
              },
            },
            entregador: { select: { nome: true } },
          },
        },
      },
    });
  }

  procurarAcessoDoPedido(idPedido: number): Promise<AcessoRecebedor | null> {
    return this.prisma.acessoRecebedor.findUnique({ where: { idPedido } });
  }

  async registrarTentativaErrada(
    idPedido: number,
    tentativas: number,
    quando: Date,
  ): Promise<void> {
    await this.prisma.acessoRecebedor.update({
      where: { idPedido },
      data: { tentativas_codigo: tentativas, ultima_tentativa_codigo: quando },
    });
  }

  procurarPedidoDaEmpresa(
    idPedido: number,
    idEmpresa: number,
  ): Promise<Pedido | null> {
    return this.prisma.pedido.findFirst({
      where: { id_pedido: idPedido, idEmpresa },
    });
  }
}
