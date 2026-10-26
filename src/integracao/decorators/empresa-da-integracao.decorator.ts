import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { IntegracaoAutenticada } from '../credencial.service';

export const EmpresaDaIntegracao = createParamDecorator(
  (_dados: unknown, contexto: ExecutionContext): number => {
    const requisicao = contexto
      .switchToHttp()
      .getRequest<{ integracao: IntegracaoAutenticada }>();
    return requisicao.integracao.empresaId;
  },
);
