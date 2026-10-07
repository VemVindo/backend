import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { IntegracaoAutenticada } from '../credencial.service';

export const EmpresaDaIntegracao = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): number => {
    const requisicao = ctx
      .switchToHttp()
      .getRequest<{ integracao: IntegracaoAutenticada }>();
    return requisicao.integracao.empresaId;
  },
);
