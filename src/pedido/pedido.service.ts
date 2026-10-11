import { Injectable } from '@nestjs/common';
import { PedidoDto } from './dto/pedido.dto';
import { StatusFactory } from './factory/status.factory';
import { PedidoRepository } from './pedido.repository';
import { Pedido } from '../generated/prisma/client';

@Injectable()
export class PedidoService {
  constructor(private readonly pedidoRepository: PedidoRepository) {}

  async criar(pedidoDto: PedidoDto): Promise<Pedido> {
    pedidoDto.status = StatusFactory.criar(pedidoDto.cpf_entregador);
    pedidoDto.data_criacao = new Date().toISOString();
    return this.pedidoRepository.criar(pedidoDto);
  }
}
