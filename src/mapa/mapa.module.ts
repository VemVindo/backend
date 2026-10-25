import { Module } from '@nestjs/common';
import { RastreioModule } from '../rastreio/rastreio.module';
import { GoogleMapsClient } from './google-maps.client';
import { LocalizacaoController } from './localizacao.controller';
import { LocalizacaoRepository } from './localizacao.repository';
import { LocalizacaoService } from './localizacao.service';
import { RotaDeCarroService } from './rota-de-carro.service';

@Module({
  imports: [RastreioModule],
  controllers: [LocalizacaoController],
  providers: [
    GoogleMapsClient,
    LocalizacaoRepository,
    LocalizacaoService,
    RotaDeCarroService,
  ],
  exports: [LocalizacaoService, RotaDeCarroService, GoogleMapsClient],
})
export class MapaModule {}
