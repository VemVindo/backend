import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Cargo } from '../common/enums/cargo.enum';
import { CargosGuard } from './cargos.guard';
import { UsuarioAutenticado } from './jwt.strategy';

function contexto(usuario?: UsuarioAutenticado): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user: usuario }) }),
  } as unknown as ExecutionContext;
}

describe('CargosGuard', () => {
  const reflector = new Reflector();
  const guard = new CargosGuard(reflector);
  const empresa: UsuarioAutenticado = {
    usuarioId: '1',
    cargo: Cargo.ESTABELECIMENTO,
    empresaId: '1',
  };

  afterEach(() => jest.restoreAllMocks());

  it('libera rota sem @Cargos', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(contexto(empresa))).toBe(true);
  });

  it('libera o cargo exigido, lendo request.user', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([Cargo.ESTABELECIMENTO]);
    expect(guard.canActivate(contexto(empresa))).toBe(true);
  });

  it('bloqueia outro cargo e requisicao sem usuario', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([Cargo.ENTREGADOR]);
    expect(() => guard.canActivate(contexto(empresa))).toThrow(
      ForbiddenException,
    );
    expect(() => guard.canActivate(contexto())).toThrow(ForbiddenException);
  });
});
