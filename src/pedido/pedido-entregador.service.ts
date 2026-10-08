import { Injectable } from '@nestjs/common';
import { pedidoVisivelParaEntregador } from './pedido-visivel-entregador';
import { PedidoRepository } from './pedido.repository';

@Injectable()
export class PedidoEntregadorService {
  constructor(private readonly pedidos: PedidoRepository) {}

  async listar(cpfEntregador: string) {
    const pedidos = await this.pedidos.listarDoEntregador(cpfEntregador);
    return pedidos.map(pedidoVisivelParaEntregador);
  }
}
