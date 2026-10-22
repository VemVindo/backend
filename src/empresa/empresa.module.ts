import { Module } from '@nestjs/common';
import { CadastroEmpresaController } from './cadastro-empresa.controller';
import { EmpresaController } from './empresa.controller';
import { EmpresaRepository } from './empresa.repository';
import { EmpresaService } from './empresa.service';

@Module({
  controllers: [EmpresaController, CadastroEmpresaController],
  providers: [EmpresaRepository, EmpresaService],
  exports: [EmpresaRepository],
})
export class EmpresaModule {}
