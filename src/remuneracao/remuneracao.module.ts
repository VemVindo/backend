import { Module } from '@nestjs/common';
import { CalculoValorEntregaService } from './calculo-valor-entrega.service';
import { GanhoEntregaService } from './ganho-entrega.service';
import { RemuneracaoController } from './remuneracao.controller';
import { RemuneracaoRepository } from './remuneracao.repository';
import { RemuneracaoService } from './remuneracao.service';

@Module({
  controllers: [RemuneracaoController],
  providers: [
    CalculoValorEntregaService,
    GanhoEntregaService,
    RemuneracaoRepository,
    RemuneracaoService,
  ],
  exports: [CalculoValorEntregaService, GanhoEntregaService],
})
export class RemuneracaoModule {}
