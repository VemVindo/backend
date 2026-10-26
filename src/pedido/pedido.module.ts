import { Module } from '@nestjs/common';
import { EntregadorModule } from '../entregador/entregador.module';
import { MapaModule } from '../mapa/mapa.module';
import { RastreioModule } from '../rastreio/rastreio.module';
import { RemuneracaoModule } from '../remuneracao/remuneracao.module';
import { ConversaDoPedidoService } from './conversa-do-pedido.service';
import { PedidoController } from './pedido.controller';
import { PedidoRepository } from './pedido.repository';
import { PedidoService } from './pedido.service';

@Module({
  imports: [EntregadorModule, MapaModule, RastreioModule, RemuneracaoModule],
  controllers: [PedidoController],
  providers: [PedidoService, ConversaDoPedidoService, PedidoRepository],
})
export class PedidoModule {}
