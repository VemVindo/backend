import { Module } from '@nestjs/common';
import { EmpresaController } from './empresa.controller';
import { EmpresaRepository } from './empresa.repository';
import { EmpresaService } from './empresa.service';

@Module({
  controllers: [EmpresaController],
  providers: [EmpresaRepository, EmpresaService],
  exports: [EmpresaRepository],
})
export class EmpresaModule {}
