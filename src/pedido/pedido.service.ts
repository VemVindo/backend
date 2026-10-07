import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StatusPedido } from '../common/enums/status-pedido.enum';
import { PedidoRepository } from './pedido.repository';
import {
  obterStatusDisponiveis,
  transicaoPermitida,
} from './regras/status-pedido.regra';

@Injectable()
export class PedidoService {
  constructor(
    private readonly pedidoRepository: PedidoRepository,
  ) { }

  async atualizarStatus(
    cpfEntregador: string,
    idPedido: number,
    novoStatus: StatusPedido,
  ) {
    const pedido =
      await this.pedidoRepository.procurarAtribuidoAoEntregador(
        idPedido,
        cpfEntregador,
      );

    if (!pedido) {
      throw new NotFoundException('Pedido não encontrado');
    }

    const statusAtual = pedido.status as StatusPedido;

    if (!transicaoPermitida(statusAtual, novoStatus)) {
      throw new ConflictException(
        `Não é permitido alterar o pedido de ${statusAtual} para ${novoStatus}`,
      );
    }

    return this.pedidoRepository.atualizarStatus(
      idPedido,
      novoStatus,
    );
  }

  async obterStatusDisponiveis(
    cpfEntregador: string,
    idPedido: number,
  ) {
    const pedido =
      await this.pedidoRepository.procurarAtribuidoAoEntregador(
        idPedido,
        cpfEntregador,
      );

    if (!pedido) {
      throw new NotFoundException('Pedido não encontrado');
    }

    const statusAtual = pedido.status as StatusPedido;

    return obterStatusDisponiveis(statusAtual);
  }
}