import { StatusPedido } from '../../generated/prisma/enums';
import type { PedidoComEmpresa } from '../pedido.repository';

// O entregador ve o necessario para a entrega; o telefone do recebedor fica
// de fora ate existir o canal de contato (E-US20).
export interface PedidoDoEntregadorDto {
  id: number;
  status: StatusPedido;
  empresa: string;
  recebedor: string;
  endereco: string;
  valorEntrega: number;
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
    distancia: pedido.distancia,
    criadoEm: pedido.data_criacao,
    iniciadoEm: pedido.data_inicio_entrega,
    finalizadoEm: pedido.data_finalizacao,
  };
}
