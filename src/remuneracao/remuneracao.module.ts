import { Module } from '@nestjs/common';
import { CalculoValorEntregaService } from './calculo-valor-entrega.service';

@Module({
  providers: [CalculoValorEntregaService],
  exports: [CalculoValorEntregaService],
})
export class RemuneracaoModule {}
