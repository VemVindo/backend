import { Injectable } from '@nestjs/common';
import { CriaPedidoReqDto } from './dto/cria-pedido.dto';
import { StatusFactory } from './factories/status.factory';
import { PedidoRepository } from './pedido.repository';
import { Pedido } from '../generated/prisma/client';

@Injectable()
export class PedidoService {
  constructor(private readonly pedidoRepository: PedidoRepository) {}

  async criar(pedido: CriaPedidoReqDto): Promise<Pedido> {
    pedido.status = StatusFactory.criar(pedido.cpf_entregador);
    pedido.data_criacao = new Date().toISOString();
    return this.pedidoRepository.criar(pedido);
  }
}
