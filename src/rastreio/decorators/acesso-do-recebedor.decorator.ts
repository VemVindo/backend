import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AcessoComPedido } from '../rastreio.repository';

export const AcessoDoRecebedor = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AcessoComPedido => {
    const requisicao = ctx
      .switchToHttp()
      .getRequest<{ acessoRecebedor: AcessoComPedido }>();
    return requisicao.acessoRecebedor;
  },
);
