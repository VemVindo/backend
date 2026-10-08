import { Module } from '@nestjs/common';
import { CredencialController } from './credencial.controller';
import { CredencialIntegracaoGuard } from './credencial-integracao.guard';
import { CredencialRepository } from './credencial.repository';
import { CredencialService } from './credencial.service';

// Quem importar este modulo pode usar @AutenticarIntegracao() nas proprias rotas.
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
