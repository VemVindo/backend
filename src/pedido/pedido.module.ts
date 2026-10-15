import { Module } from '@nestjs/common';
import { EntregadorModule } from '../entregador/entregador.module';
import { MapaModule } from '../mapa/mapa.module';
import { PedidoController } from './pedido.controller';
import { PedidoRepository } from './pedido.repository';
import { PedidoService } from './pedido.service';

@Module({
  imports: [EntregadorModule, MapaModule],
  controllers: [PedidoController],
  providers: [PedidoService, PedidoRepository],
})
export class PedidoModule {}
