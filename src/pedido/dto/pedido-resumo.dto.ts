import { StatusPedido } from '../../generated/prisma/enums';
import type { PedidoComEntregador } from '../pedido.repository';

// Formato consumido pelo front nas listas e acoes sobre pedidos ativos.
export interface PedidoResumoDto {
  id: number;
  recebedor: string;
  entregador: string | null;
  status: StatusPedido;
  criadoEm: Date;
  valorEntrega: number;
  ganhoConsolidadoCentavos: number | null;
  distanciaConhecida: boolean | null;
  finalizadoEm: Date | null;
  nota: number | null;
}

export function paraPedidoResumo(pedido: PedidoComEntregador): PedidoResumoDto {
  return {
    id: pedido.id_pedido,
    recebedor: pedido.nome_recebedor,
    entregador: pedido.entregador?.nome ?? null,
    status: pedido.status,
    criadoEm: pedido.data_criacao,
    valorEntrega: pedido.valor_entrega,
    ganhoConsolidadoCentavos: pedido.ganho_consolidado_centavos ?? null,
    distanciaConhecida: pedido.distancia_conhecida ?? null,
    finalizadoEm: pedido.data_finalizacao,
    nota: pedido.avaliacao?.avaliacao_entrega ?? null,
  };
}
