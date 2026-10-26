import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CHAVE_PERMITIR_SENHA_TEMPORARIA } from './decorators/permitir-senha-temporaria.decorator';
import { UsuarioAutenticado } from './jwt.strategy';

@Injectable()
export class SenhaTemporariaGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const permitido = this.reflector.getAllAndOverride<boolean>(
      CHAVE_PERMITIR_SENHA_TEMPORARIA,
      [contexto.getHandler(), contexto.getClass()],
    );
    if (permitido) {
      return true;
    }

    const { user: usuario } = contexto
      .switchToHttp()
      .getRequest<{ user?: UsuarioAutenticado }>();
    if (usuario?.senhaTemporaria) {
      throw new ForbiddenException(
        'Troque a senha temporaria antes de continuar',
      );
    }
    return true;
  }
}
