import { Module } from '@nestjs/common';
import { EmpresaRepository } from './empresa.repository';

@Module({
  providers: [EmpresaRepository],
  exports: [EmpresaRepository],
})
export class EmpresaModule {}
