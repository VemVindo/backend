import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { CHAVE_ROTA_PUBLICA } from './decorators/rota-publica.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(contexto: ExecutionContext) {
    const rotaPublica = this.reflector.getAllAndOverride<boolean>(
      CHAVE_ROTA_PUBLICA,
      [contexto.getHandler(), contexto.getClass()],
    );
    if (rotaPublica) {
      return true;
    }
    return super.canActivate(contexto);
  }
}
