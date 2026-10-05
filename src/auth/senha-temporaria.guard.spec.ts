import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../common/enums/user-role.enum';
import { AuthenticatedUser } from './jwt.strategy';
import { SenhaTemporariaGuard } from './senha-temporaria.guard';

function contexto(user?: AuthenticatedUser): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('SenhaTemporariaGuard', () => {
  const reflector = new Reflector();
  const guard = new SenhaTemporariaGuard(reflector);
  const entregadorTemporario: AuthenticatedUser = {
    userId: '12345678900',
    role: UserRole.ENTREGADOR,
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
    const user = { ...entregadorTemporario, senhaTemporaria: false };
    expect(guard.canActivate(contexto(user))).toBe(true);
  });

  it('libera rotas publicas, sem usuario', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(contexto())).toBe(true);
  });
});
