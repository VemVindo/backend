import { Module } from '@nestjs/common';
import { AcessoRecebedorGuard } from './acesso-recebedor.guard';
import { CodigoDoRecebedorService } from './codigo-do-recebedor.service';
import { RastreioController } from './rastreio.controller';
import { RastreioGateway } from './rastreio.gateway';
import { RastreioRepository } from './rastreio.repository';
import { RastreioService } from './rastreio.service';
import { ValidadorDeLink } from './validador-de-link';

@Module({
  controllers: [RastreioController],
  providers: [
    RastreioRepository,
    ValidadorDeLink,
    RastreioGateway,
    RastreioService,
    AcessoRecebedorGuard,
    CodigoDoRecebedorService,
  ],
  exports: [
    RastreioService,
    RastreioGateway,
    ValidadorDeLink,
    AcessoRecebedorGuard,
    CodigoDoRecebedorService,
  ],
})
export class RastreioModule {}
