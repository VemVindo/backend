import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StatusPedido } from '../common/enums/status-pedido.enum';
import { EntregadorRepository } from '../entregador/entregador.repository';
import { Pedido } from '../generated/prisma/client';
import { CriaPedidoReqDto } from './dto/cria-pedido.dto';
import { StatusFactory } from './factories/status.factory';
import { PedidoRepository } from './pedido.repository';
import {
  obterStatusDisponiveis,
  transicaoPermitida,
} from './regras/status-pedido.regra';

@Injectable()
export class PedidoService {
  constructor(
    private readonly pedidoRepository: PedidoRepository,
    private readonly entregadorRepository: EntregadorRepository,
  ) {}

  async criar(pedido: CriaPedidoReqDto): Promise<Pedido> {
    pedido.status = StatusFactory.criar(pedido.cpf_entregador);
    pedido.data_criacao = new Date().toISOString();
    return this.pedidoRepository.criar(pedido);
  }

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

    return {
      statusAtual,
      statusDisponiveis: obterStatusDisponiveis(statusAtual),
    };
  }

  async reatribuir(
    idEmpresa: number,
    idPedido: number,
    cpfNovoEntregador: string,
  ) {
    const pedido = await this.pedidoRepository.procurarPorEmpresa(
      idPedido,
      idEmpresa,
    );

    if (!pedido) {
      throw new NotFoundException('Pedido não encontrado');
    }

    const statusAtual = pedido.status as StatusPedido;

    const podeReatribuir =
      statusAtual === StatusPedido.PENDENTE ||
      statusAtual === StatusPedido.EM_ANDAMENTO;

    if (!podeReatribuir) {
      throw new ConflictException(
        'Pedido não pode ser reatribuído no status atual',
      );
    }

    if (!pedido.cpf_entregador) {
      throw new ConflictException(
        'Pedido não possui entregador para ser reatribuído',
      );
    }

    if (pedido.cpf_entregador === cpfNovoEntregador) {
      throw new ConflictException(
        'O entregador informado já está atribuído ao pedido',
      );
    }

    const novoEntregador =
      await this.entregadorRepository.procurarAtivoPorEmpresa(
        idEmpresa,
        cpfNovoEntregador,
      );

    if (!novoEntregador) {
      throw new NotFoundException(
        'Entregador não encontrado na frota da empresa',
      );
    }

    if (!novoEntregador.disponivel) {
      throw new ConflictException(
        'Entregador não está disponível',
      );
    }

    const reatribuido = await this.pedidoRepository.reatribuir(
      idPedido,
      pedido.cpf_entregador,
      cpfNovoEntregador,
    );

    return {
      id: reatribuido.id_pedido,
      recebedor: reatribuido.nome_recebedor,
      entregador: reatribuido.entregador?.nome ?? null,
      status: reatribuido.status,
      criadoEm: reatribuido.data_criacao,
    };
  }
}