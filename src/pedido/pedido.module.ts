import { Module } from '@nestjs/common';
import { PedidoService } from './pedido.service';
import { PedidoController } from './pedido.controller';
import { PedidoEntregadorController } from './pedido-entregador.controller';
import { PedidoEntregadorService } from './pedido-entregador.service';
import { PedidoRepository } from './pedido.repository';

@Module({
  controllers: [PedidoController, PedidoEntregadorController],
  providers: [PedidoService, PedidoEntregadorService, PedidoRepository],
})
export class PedidoModule {}
