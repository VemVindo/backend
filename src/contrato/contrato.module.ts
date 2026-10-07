import { Module } from '@nestjs/common';
import { ContratoRepository } from './contrato.repository';

@Module({
  providers: [ContratoRepository],
  exports: [ContratoRepository],
})
export class ContratoModule {}
