import type { Request, Response } from 'express';
import {
  AUTH_COOKIE,
  definirCookieAuth,
  extrairTokenDoCookie,
  limparCookieAuth,
} from './auth-cookie';

function requisicao(cookie?: string): Request {
  return { headers: cookie === undefined ? {} : { cookie } } as Request;
}

describe('extrairTokenDoCookie', () => {
  it('retorna null sem header de cookie', () => {
    expect(extrairTokenDoCookie(requisicao())).toBeNull();
  });

  it('encontra o token entre outros cookies', () => {
    const req = requisicao(`tema=escuro; ${AUTH_COOKIE}=abc.def.ghi; outro=1`);
    expect(extrairTokenDoCookie(req)).toBe('abc.def.ghi');
  });

  it('decodifica valores com caracteres escapados', () => {
    const req = requisicao(`${AUTH_COOKIE}=a%3Db`);
    expect(extrairTokenDoCookie(req)).toBe('a=b');
  });

  it('ignora cookie com nome parecido', () => {
    const req = requisicao(`x${AUTH_COOKIE}=falso`);
    expect(extrairTokenDoCookie(req)).toBeNull();
  });
});

describe('definirCookieAuth / limparCookieAuth', () => {
  it('grava o cookie como httpOnly e com a expiracao do token', () => {
    const cookie = jest.fn();
    const res = { cookie } as unknown as Response;
    const expiraEm = new Date('2030-01-01T00:00:00Z');

    definirCookieAuth(res, 'token', expiraEm);

    expect(cookie).toHaveBeenCalledWith(
      AUTH_COOKIE,
      'token',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        expires: expiraEm,
      }),
    );
  });

  describe('com COOKIE_SAMESITE=none', () => {
    const original = process.env.COOKIE_SAMESITE;

    beforeEach(() => {
      process.env.COOKIE_SAMESITE = 'none';
    });

    afterEach(() => {
      if (original === undefined) {
        delete process.env.COOKIE_SAMESITE;
      } else {
        process.env.COOKIE_SAMESITE = original;
      }
    });

    it('envia SameSite=None e forca Secure', () => {
      const cookie = jest.fn();
      const res = { cookie } as unknown as Response;

      definirCookieAuth(res, 'token', new Date('2030-01-01T00:00:00Z'));

      expect(cookie).toHaveBeenCalledWith(
        AUTH_COOKIE,
        'token',
        expect.objectContaining({ sameSite: 'none', secure: true }),
      );
    });
  });

  it('limpa o cookie com as mesmas opcoes', () => {
    const clearCookie = jest.fn();
    const res = { clearCookie } as unknown as Response;

    limparCookieAuth(res);

    expect(clearCookie).toHaveBeenCalledWith(
      AUTH_COOKIE,
      expect.objectContaining({ httpOnly: true, path: '/' }),
    );
  });
});
