import { Module } from '@nestjs/common';
import { RemuneracaoModule } from '../remuneracao/remuneracao.module';
import { CredencialController } from './credencial.controller';
import { CredencialIntegracaoGuard } from './credencial-integracao.guard';
import { CredencialRepository } from './credencial.repository';
import { CredencialService } from './credencial.service';
import { ImportacaoController } from './importacao/importacao.controller';
import { ImportacaoRepository } from './importacao/importacao.repository';
import { ImportacaoService } from './importacao/importacao.service';

@Module({
  imports: [RemuneracaoModule],
  controllers: [CredencialController, ImportacaoController],
  providers: [
    CredencialRepository,
    CredencialService,
    CredencialIntegracaoGuard,
    ImportacaoRepository,
    ImportacaoService,
  ],
  exports: [CredencialService, CredencialIntegracaoGuard],
})
export class IntegracaoModule {}
