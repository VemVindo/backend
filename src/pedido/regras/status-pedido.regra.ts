import { StatusPedido } from '../../common/enums/status-pedido.enum';

const TRANSICOES_PEDIDO: Record<StatusPedido, readonly StatusPedido[]> = {
  [StatusPedido.PENDENTE]: [
    StatusPedido.EM_ANDAMENTO,
  ],

  [StatusPedido.EM_ANDAMENTO]: [
    StatusPedido.FINALIZADO,
  ],

  [StatusPedido.FINALIZADO]: [],

  [StatusPedido.CANCELADO]: [],
};

export function obterStatusDisponiveis(
  statusAtual: StatusPedido,
): readonly StatusPedido[] {
  return TRANSICOES_PEDIDO[statusAtual];
}

export function transicaoPermitida(
  statusAtual: StatusPedido,
  novoStatus: StatusPedido,
): boolean {
  return TRANSICOES_PEDIDO[statusAtual].includes(novoStatus);
}