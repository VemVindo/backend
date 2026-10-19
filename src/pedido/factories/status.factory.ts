import { StatusPedido } from '../../generated/prisma';

export class StatusFactory {
  static criar(cpf_entregador: string | undefined): StatusPedido {
    if (cpf_entregador) return StatusPedido.EM_ANDAMENTO;
    else return StatusPedido.PENDENTE;
  }
}
