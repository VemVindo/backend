import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UsuarioAutenticado } from '../jwt.strategy';

// request.user e o nome usado pelo Passport, por isso fica em ingles.
export const UsuarioAtual = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UsuarioAutenticado => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ user: UsuarioAutenticado }>();
    return request.user;
  },
);
