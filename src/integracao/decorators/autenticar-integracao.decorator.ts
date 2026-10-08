import { applyDecorators, UseGuards } from '@nestjs/common';
import { Public } from '../../auth/decorators/public.decorator';
import { CredencialIntegracaoGuard } from '../credencial-integracao.guard';

// Troca o login (JWT) pela chave no cabecalho X-Api-Key. Use nas rotas chamadas
// pelo sistema externo do estabelecimento, junto com @EmpresaDaIntegracao().
export const AutenticarIntegracao = () =>
  applyDecorators(Public(), UseGuards(CredencialIntegracaoGuard));
