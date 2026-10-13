import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMITIR_SENHA_TEMPORARIA_KEY } from './decorators/permitir-senha-temporaria.decorator';
import { UsuarioAutenticado } from './jwt.strategy';

@Injectable()
export class SenhaTemporariaGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const permitido = this.reflector.getAllAndOverride<boolean>(
      PERMITIR_SENHA_TEMPORARIA_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (permitido) {
      return true;
    }

    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: UsuarioAutenticado }>();
    if (user?.senhaTemporaria) {
      throw new ForbiddenException(
        'Troque a senha temporaria antes de continuar',
      );
    }
    return true;
  }
}
