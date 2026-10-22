import { Module } from '@nestjs/common';
import { EntregadorModule } from '../entregador/entregador.module';
import { MapaModule } from '../mapa/mapa.module';
import { RastreioModule } from '../rastreio/rastreio.module';
import { PedidoController } from './pedido.controller';
import { PedidoRepository } from './pedido.repository';
import { PedidoService } from './pedido.service';

@Module({
  imports: [EntregadorModule, MapaModule, RastreioModule],
  controllers: [PedidoController],
  providers: [PedidoService, PedidoRepository],
})
export class PedidoModule {}
