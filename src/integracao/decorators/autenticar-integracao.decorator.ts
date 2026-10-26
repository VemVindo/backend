import { applyDecorators, UseGuards } from '@nestjs/common';
import { RotaPublica } from '../../auth/decorators/rota-publica.decorator';
import { CredencialIntegracaoGuard } from '../credencial-integracao.guard';

export const AutenticarIntegracao = () =>
  applyDecorators(RotaPublica(), UseGuards(CredencialIntegracaoGuard));
