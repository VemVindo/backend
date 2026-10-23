import { StatusPedido } from '../../generated/prisma/enums';

const TRANSICOES_PEDIDO: Record<StatusPedido, readonly StatusPedido[]> = {
  [StatusPedido.PENDENTE]: [StatusPedido.EM_ANDAMENTO],

  [StatusPedido.EM_ANDAMENTO]: [StatusPedido.FINALIZADO],

  [StatusPedido.FINALIZADO]: [],

  [StatusPedido.CANCELADO]: [],
};

const STATUS_QUE_EXIGEM_CODIGO: readonly StatusPedido[] = [
  StatusPedido.FINALIZADO,
];

export function exigeCodigoDoRecebedor(status: StatusPedido): boolean {
  return STATUS_QUE_EXIGEM_CODIGO.includes(status);
}

export function obterStatusDisponiveis(
  statusAtual: StatusPedido,
): readonly StatusPedido[] {
  return TRANSICOES_PEDIDO[statusAtual].filter(
    (status) => !exigeCodigoDoRecebedor(status),
  );
}

export function transicaoPermitida(
  statusAtual: StatusPedido,
  novoStatus: StatusPedido,
): boolean {
  return TRANSICOES_PEDIDO[statusAtual].includes(novoStatus);
}

export function statusFinal(status: StatusPedido): boolean {
  return TRANSICOES_PEDIDO[status].length === 0;
}
