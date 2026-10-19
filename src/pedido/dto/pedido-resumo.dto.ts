import { StatusPedido } from '../../generated/prisma';
import type { PedidoComEntregador } from '../pedido.repository';

// Formato consumido pelo front nas listas e acoes sobre pedidos ativos.
export interface PedidoResumoDto {
  id: number;
  recebedor: string;
  entregador: string | null;
  status: StatusPedido;
  criadoEm: Date;
}

export function paraPedidoResumo(pedido: PedidoComEntregador): PedidoResumoDto {
  return {
    id: pedido.id_pedido,
    recebedor: pedido.nome_recebedor,
    entregador: pedido.entregador?.nome ?? null,
    status: pedido.status,
    criadoEm: pedido.data_criacao,
  };
}
