import { Module } from '@nestjs/common';
import { AcessoRecebedorGuard } from './acesso-recebedor.guard';
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
  ],
  exports: [
    RastreioService,
    RastreioGateway,
    ValidadorDeLink,
    AcessoRecebedorGuard,
  ],
})
export class RastreioModule {}
