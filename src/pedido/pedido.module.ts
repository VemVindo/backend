import { Module } from '@nestjs/common';
import { PedidoEntregadorController } from './pedido-entregador.controller';
import { PedidoEntregadorService } from './pedido-entregador.service';
import { PedidoRepository } from './pedido.repository';

@Module({
  controllers: [PedidoEntregadorController],
  providers: [PedidoRepository, PedidoEntregadorService],
  exports: [PedidoRepository],
})
export class PedidoModule {}
