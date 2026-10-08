import { Pedido } from '../generated/prisma/client';
import { PedidoComEmpresa } from './pedido.repository';

export function formatarEndereco(pedido: Pedido): string {
  const complemento = pedido.complemento ? `, ${pedido.complemento}` : '';
  return `${pedido.logradouro}, ${pedido.numero}${complemento} - ${pedido.bairro}, ${pedido.cidade}/${pedido.uf}`;
}

export function pedidoVisivelParaEntregador(pedido: PedidoComEmpresa) {
  return {
    id: pedido.id_pedido,
    status: pedido.status,
    empresa: pedido.empresa.nome_fantasia,
    recebedor: pedido.nome_recebedor,
    endereco: formatarEndereco(pedido),
    criadoEm: pedido.data_criacao,
    iniciadoEm: pedido.data_inicio_entrega,
    finalizadoEm: pedido.data_finalizacao,
  };
}
