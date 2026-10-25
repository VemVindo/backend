import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Cargo } from '../common/enums/cargo.enum';
import { CHAVE_CARGOS } from './decorators/cargos.decorator';
import { UsuarioAutenticado } from './jwt.strategy';

@Injectable()
export class CargosGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const exigidos = this.reflector.getAllAndOverride<Cargo[]>(CHAVE_CARGOS, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    if (!exigidos || exigidos.length === 0) {
      return true;
    }

    const { user: usuario } = contexto
      .switchToHttp()
      .getRequest<{ user?: UsuarioAutenticado }>();
    if (!usuario || !exigidos.includes(usuario.cargo)) {
      throw new ForbiddenException('Acesso negado para o perfil atual');
    }
    return true;
  }
}
