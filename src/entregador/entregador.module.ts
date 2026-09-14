import { Module } from '@nestjs/common';
import { EntregadorRepository } from './entregador.repository';

@Module({
  providers: [EntregadorRepository],
  exports: [EntregadorRepository],
})
export class EntregadorModule {}
