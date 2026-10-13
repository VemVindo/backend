import { Module } from '@nestjs/common';
import { ContratoModule } from '../contrato/contrato.module';
import { EntregadorModule } from '../entregador/entregador.module';
import { VinculoController } from './vinculo.controller';
import { VinculoService } from './vinculo.service';

@Module({
  imports: [ContratoModule, EntregadorModule],
  controllers: [VinculoController],
  providers: [VinculoService],
})
export class VinculoModule {}
