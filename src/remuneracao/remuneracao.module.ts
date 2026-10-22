import { Module } from '@nestjs/common';
import { CalculoValorEntregaService } from './calculo-valor-entrega.service';
import { RemuneracaoController } from './remuneracao.controller';
import { RemuneracaoRepository } from './remuneracao.repository';
import { RemuneracaoService } from './remuneracao.service';

@Module({
  controllers: [RemuneracaoController],
  providers: [
    CalculoValorEntregaService,
    RemuneracaoRepository,
    RemuneracaoService,
  ],
  exports: [CalculoValorEntregaService],
})
export class RemuneracaoModule {}
