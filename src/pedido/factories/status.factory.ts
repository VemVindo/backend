import { StatusPedido } from '../../generated/prisma/enums';

export class StatusFactory {
  static criar(cpfEntregador: string | undefined): StatusPedido {
    if (cpfEntregador) return StatusPedido.EM_ANDAMENTO;
    else return StatusPedido.PENDENTE;
  }
}
