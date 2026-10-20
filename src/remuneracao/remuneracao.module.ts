import { Module } from '@nestjs/common';
import { CalculoValorEntregaService } from './calculo-valor-entrega.service';
import { RemuneracaoService } from './remuneracao.service';
import { RemuneracaoRepository } from './remuneracao.repository';
import { RemuneracaoFactory } from './factories/remuneracao.factory';
import { RemuneracaoController } from './remuneracao.controller';

@Module({
  providers: [
    CalculoValorEntregaService,
    RemuneracaoService,
    RemuneracaoRepository,
    RemuneracaoFactory,
  ],
  controllers: [RemuneracaoController],
  exports: [CalculoValorEntregaService],
})
export class RemuneracaoModule {}
