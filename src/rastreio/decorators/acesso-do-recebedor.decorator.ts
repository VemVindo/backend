import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AcessoComPedido } from '../rastreio.repository';

export const AcessoDoRecebedor = createParamDecorator(
  (_dados: unknown, contexto: ExecutionContext): AcessoComPedido => {
    const requisicao = contexto
      .switchToHttp()
      .getRequest<{ acessoRecebedor: AcessoComPedido }>();
    return requisicao.acessoRecebedor;
  },
);
