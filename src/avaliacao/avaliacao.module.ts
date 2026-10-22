import { Module } from '@nestjs/common';
import { RastreioModule } from '../rastreio/rastreio.module';
import { AcessoParaAvaliarGuard } from './acesso-para-avaliar.guard';
import {
  AvaliacaoDaEmpresaController,
  AvaliacaoDoRecebedorController,
} from './avaliacao.controller';
import { AvaliacaoRepository } from './avaliacao.repository';
import { AvaliacaoService } from './avaliacao.service';

@Module({
  imports: [RastreioModule],
  controllers: [AvaliacaoDoRecebedorController, AvaliacaoDaEmpresaController],
  providers: [AvaliacaoRepository, AvaliacaoService, AcessoParaAvaliarGuard],
})
export class AvaliacaoModule {}
