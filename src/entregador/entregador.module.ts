import { RepositorioDesempenhoEntregador } from './desempenho-entregador.repository';
import { ServicoDesempenhoEntregador } from './desempenho-entregador.service';
import { Module } from '@nestjs/common';
import { ContratoModule } from '../contrato/contrato.module';
import { MapaModule } from '../mapa/mapa.module';
import { RemuneracaoModule } from '../remuneracao/remuneracao.module';
import { EntregadorController } from './entregador.controller';
import { EntregadorRepository } from './entregador.repository';
import { EntregadorService } from './entregador.service';
import { RemocaoDaFrotaRepository } from './remocao-da-frota.repository';

@Module({
  imports: [ContratoModule, MapaModule, RemuneracaoModule],
  controllers: [EntregadorController],
  providers: [
    EntregadorRepository,
    EntregadorService,
    RepositorioDesempenhoEntregador,
    ServicoDesempenhoEntregador,
    RemocaoDaFrotaRepository,
  ],
  exports: [EntregadorRepository],
})
export class EntregadorModule {}
