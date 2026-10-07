import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Cargo } from '../common/enums/cargo.enum';
import { UsuarioAutenticado } from './jwt.strategy';
import { SenhaTemporariaGuard } from './senha-temporaria.guard';

function contexto(usuario?: UsuarioAutenticado): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user: usuario }) }),
  } as unknown as ExecutionContext;
}

describe('SenhaTemporariaGuard', () => {
  const reflector = new Reflector();
  const guard = new SenhaTemporariaGuard(reflector);
  const entregadorTemporario: UsuarioAutenticado = {
    usuarioId: '12345678900',
    cargo: Cargo.ENTREGADOR,
    senhaTemporaria: true,
  };

  afterEach(() => jest.restoreAllMocks());

  it('bloqueia entregador com senha temporaria', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(() => guard.canActivate(contexto(entregadorTemporario))).toThrow(
      ForbiddenException,
    );
  });

  it('libera rotas marcadas com @PermitirSenhaTemporaria', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    expect(guard.canActivate(contexto(entregadorTemporario))).toBe(true);
  });

  it('libera entregador que ja trocou a senha', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const usuario = { ...entregadorTemporario, senhaTemporaria: false };
    expect(guard.canActivate(contexto(usuario))).toBe(true);
  });

  it('libera rotas publicas, sem usuario', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(contexto())).toBe(true);
  });
});
