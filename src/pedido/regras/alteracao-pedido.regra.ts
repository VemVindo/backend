import { Pedido } from '../../generated/prisma/client';
import { StatusPedido } from '../../generated/prisma/enums';
import { transicaoPermitida } from './status-pedido.regra';

export interface DadosAtualizacaoStatus {
  idPedido: number;
  cpfEntregador: string;
  statusAtual: StatusPedido;
  novoStatus: StatusPedido;
  finalizar: boolean;
}

export interface DadosReatribuicao {
  idPedido: number;
  statusAtual: StatusPedido;
  cpfAnterior: string | null;
  cpfNovo: string;
}

export function podeAtualizarStatus(
  pedido: Pedido,
  dados: DadosAtualizacaoStatus,
): boolean {
  return (
    pedido.status === dados.statusAtual &&
    pedido.cpf_entregador === dados.cpfEntregador &&
    pedido.ganho_consolidado_centavos === null &&
    transicaoPermitida(pedido.status, dados.novoStatus)
  );
}

export function podeReatribuir(
  pedido: Pedido,
  dados: DadosReatribuicao,
): boolean {
  return (
    pedido.status === dados.statusAtual &&
    pedido.cpf_entregador === dados.cpfAnterior &&
    pedido.ganho_consolidado_centavos === null &&
    (pedido.status === StatusPedido.PENDENTE ||
      pedido.status === StatusPedido.EM_ANDAMENTO) &&
    dados.cpfAnterior !== dados.cpfNovo
  );
}
