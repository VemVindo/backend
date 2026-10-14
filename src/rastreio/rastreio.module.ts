import { Module } from '@nestjs/common';
import { AcessoRecebedorGuard } from './acesso-recebedor.guard';
import { RastreioController } from './rastreio.controller';
import { RastreioRepository } from './rastreio.repository';
import { RastreioService } from './rastreio.service';

@Module({
  controllers: [RastreioController],
  providers: [RastreioRepository, RastreioService, AcessoRecebedorGuard],
  exports: [RastreioService, AcessoRecebedorGuard],
})
export class RastreioModule {}
