import { Module } from '@nestjs/common';
import { CredencialController } from './credencial.controller';
import { CredencialIntegracaoGuard } from './credencial-integracao.guard';
import { CredencialRepository } from './credencial.repository';
import { CredencialService } from './credencial.service';

@Module({
  controllers: [CredencialController],
  providers: [
    CredencialRepository,
    CredencialService,
    CredencialIntegracaoGuard,
  ],
  exports: [CredencialService, CredencialIntegracaoGuard],
})
export class IntegracaoModule {}
