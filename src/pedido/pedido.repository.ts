import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '../generated/prisma/client';

export const pedidoAtivoSelect = {
  id_pedido: true,
  nome_recebedor: true,
  telefone_recebedor: true,
  logradouro: true,
  numero: true,
  complemento: true,
  bairro: true,
  cidade: true,
  uf: true,
  descricao: true,
  status: true,
  data_criacao: true,
  data_inicio_entrega: true,
  valor_entrega: true,
  distancia: true,
  entregador: {
    select: {
      cpf: true,
      nome: true,
    },
  },
} satisfies Prisma.PedidoSelect;

@Injectable()
export class PedidoRepository {
  constructor(private readonly prisma: PrismaService) {}

  listarAtivosPorEmpresa(id_empresa: number) {
    return this.prisma.pedido.findMany({
      where: {
        idEmpresa: id_empresa,
        data_finalizacao: null,
      },
      select: pedidoAtivoSelect,
      orderBy: { data_criacao: 'desc' },
    });
  }
}
