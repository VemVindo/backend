import { Module } from '@nestjs/common';
import { PedidoService } from './pedido.service';
import { PedidoController } from './pedido.controller';
import { PedidoRepository } from './pedido.repository';

@Module({
  controllers: [PedidoController],
  providers: [PedidoService, PedidoRepository],
})
export class PedidoModule {}
