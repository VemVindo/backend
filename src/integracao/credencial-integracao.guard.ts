import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { CredencialService, IntegracaoAutenticada } from './credencial.service';

export const CABECALHO_CHAVE = 'x-api-key';

export type RequisicaoIntegracao = Request & {
  integracao?: IntegracaoAutenticada;
};

@Injectable()
export class CredencialIntegracaoGuard implements CanActivate {
  constructor(private readonly credenciais: CredencialService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requisicao = context
      .switchToHttp()
      .getRequest<RequisicaoIntegracao>();
    const chave = requisicao.headers[CABECALHO_CHAVE];
    if (typeof chave !== 'string' || !chave) {
      throw new UnauthorizedException('Credencial de integracao ausente');
    }
    const integracao = await this.credenciais.autenticar(chave);
    if (!integracao) {
      throw new UnauthorizedException('Credencial de integracao invalida');
    }
    requisicao.integracao = integracao;
    return true;
  }
}
