import { StatusPedido } from '../../generated/prisma/enums';
import type { PedidoComEmpresa } from '../pedido.repository';

export interface PedidoDoEntregadorDto {
  id: number;
  status: StatusPedido;
  empresa: string;
  recebedor: string;
  endereco: string;
  valorEntrega: number;
  ganhoConsolidadoCentavos: number | null;
  distanciaConhecida: boolean | null;
  distancia: number;
  criadoEm: Date;
  iniciadoEm: Date | null;
  finalizadoEm: Date | null;
}

export function formatarEndereco(pedido: PedidoComEmpresa): string {
  const complemento = pedido.complemento ? `, ${pedido.complemento}` : '';
  return `${pedido.logradouro}, ${pedido.numero}${complemento} - ${pedido.bairro}, ${pedido.cidade}/${pedido.uf}`;
}

export function paraPedidoDoEntregador(
  pedido: PedidoComEmpresa,
): PedidoDoEntregadorDto {
  return {
    id: pedido.id_pedido,
    status: pedido.status,
    empresa: pedido.empresa.nome_fantasia,
    recebedor: pedido.nome_recebedor,
    endereco: formatarEndereco(pedido),
    valorEntrega: pedido.valor_entrega,
    ganhoConsolidadoCentavos: pedido.ganho_consolidado_centavos ?? null,
    distanciaConhecida: pedido.distancia_conhecida ?? null,
    distancia: pedido.distancia,
    criadoEm: pedido.data_criacao,
    iniciadoEm: pedido.data_inicio_entrega,
    finalizadoEm: pedido.data_finalizacao,
  };
}
