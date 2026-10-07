import { Module } from '@nestjs/common';
import { ContratoModule } from '../contrato/contrato.module';
import { EntregadorController } from './entregador.controller';
import { EntregadorRepository } from './entregador.repository';
import { EntregadorService } from './entregador.service';

@Module({
  imports: [ContratoModule],
  controllers: [EntregadorController],
  providers: [EntregadorRepository, EntregadorService],
  exports: [EntregadorRepository],
})
export class EntregadorModule {}
