import { Module } from '@nestjs/common';
import { PedidoController } from './pedido.controller';
import { PedidoRepository } from './pedido.repository';
import { PedidoService } from './pedido.service';
import { EntregadorModule } from '../entregador/entregador.module';

@Module({
  imports: [EntregadorModule],
  controllers: [PedidoController],
  providers: [
    PedidoService,
    PedidoRepository,
  ],
})
export class PedidoModule {}