import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CHAVE_ROTA_PUBLICA } from './decorators/rota-publica.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';

function contextoDaRota(): ExecutionContext {
  return {
    getHandler: () => 'handler',
    getClass: () => 'classe',
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  const guardDoPassport = Object.getPrototypeOf(JwtAuthGuard.prototype) as {
    canActivate: (contexto: ExecutionContext) => unknown;
  };

  afterEach(() => jest.restoreAllMocks());

  it('libera rota publica sem consultar o token', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(true) };
    const validarToken = jest.spyOn(guardDoPassport, 'canActivate');
    const guard = new JwtAuthGuard(reflector as unknown as Reflector);
    const contexto = contextoDaRota();

    expect(guard.canActivate(contexto)).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
      CHAVE_ROTA_PUBLICA,
      ['handler', 'classe'],
    );
    expect(validarToken).not.toHaveBeenCalled();
  });

  it('exige o token JWT nas demais rotas', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
    const validarToken = jest
      .spyOn(guardDoPassport, 'canActivate')
      .mockReturnValue('resultado-do-passport');
    const guard = new JwtAuthGuard(reflector as unknown as Reflector);
    const contexto = contextoDaRota();

    expect(guard.canActivate(contexto)).toBe('resultado-do-passport');
    expect(validarToken).toHaveBeenCalledWith(contexto);
  });
});
