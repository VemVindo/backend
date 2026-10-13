import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Cargo } from '../common/enums/cargo.enum';
import { CARGOS_KEY } from './decorators/cargos.decorator';
import { UsuarioAutenticado } from './jwt.strategy';

@Injectable()
export class CargosGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const exigidos = this.reflector.getAllAndOverride<Cargo[]>(CARGOS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!exigidos || exigidos.length === 0) {
      return true;
    }

    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: UsuarioAutenticado }>();
    if (!user || !exigidos.includes(user.cargo)) {
      throw new ForbiddenException('Acesso negado para o perfil atual');
    }
    return true;
  }
}
