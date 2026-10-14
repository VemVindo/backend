import { applyDecorators, UseGuards } from '@nestjs/common';
import { Public } from '../../auth/decorators/public.decorator';
import { CredencialIntegracaoGuard } from '../credencial-integracao.guard';

export const AutenticarIntegracao = () =>
  applyDecorators(Public(), UseGuards(CredencialIntegracaoGuard));
