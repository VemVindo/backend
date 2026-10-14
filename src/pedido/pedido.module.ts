import { Module } from '@nestjs/common';
import { EntregadorModule } from '../entregador/entregador.module';
import { PedidoController } from './pedido.controller';
import { PedidoEntregadorController } from './pedido-entregador.controller';
import { PedidoEntregadorService } from './pedido-entregador.service';
import { PedidoRepository } from './pedido.repository';
import { PedidoService } from './pedido.service';

@Module({
  imports: [EntregadorModule],
  controllers: [PedidoController, PedidoEntregadorController],
  providers: [PedidoService, PedidoEntregadorService, PedidoRepository],
})
export class PedidoModule {}
