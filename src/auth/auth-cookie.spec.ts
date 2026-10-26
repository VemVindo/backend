import type { Request, Response } from 'express';
import {
  COOKIE_DE_AUTENTICACAO,
  definirCookieDeAutenticacao,
  extrairTokenDoCookie,
  limparCookieDeAutenticacao,
} from './auth-cookie';

function requisicaoComCookie(cookie?: string): Request {
  return { headers: cookie === undefined ? {} : { cookie } } as Request;
}

describe('extrairTokenDoCookie', () => {
  it('retorna null sem header de cookie', () => {
    expect(extrairTokenDoCookie(requisicaoComCookie())).toBeNull();
  });

  it('encontra o token entre outros cookies', () => {
    const requisicao = requisicaoComCookie(
      `tema=escuro; ${COOKIE_DE_AUTENTICACAO}=abc.def.ghi; outro=1`,
    );
    expect(extrairTokenDoCookie(requisicao)).toBe('abc.def.ghi');
  });

  it('decodifica valores com caracteres escapados', () => {
    const requisicao = requisicaoComCookie(`${COOKIE_DE_AUTENTICACAO}=a%3Db`);
    expect(extrairTokenDoCookie(requisicao)).toBe('a=b');
  });

  it('ignora cookie com nome parecido', () => {
    const requisicao = requisicaoComCookie(`x${COOKIE_DE_AUTENTICACAO}=falso`);
    expect(extrairTokenDoCookie(requisicao)).toBeNull();
  });
});

describe('definirCookieDeAutenticacao / limparCookieDeAutenticacao', () => {
  it('grava o cookie como httpOnly e com a expiracao do token', () => {
    const cookie = jest.fn();
    const resposta = { cookie } as unknown as Response;
    const expiraEm = new Date('2030-01-01T00:00:00Z');

    definirCookieDeAutenticacao(resposta, 'token', expiraEm);

    expect(cookie).toHaveBeenCalledWith(
      COOKIE_DE_AUTENTICACAO,
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
      const resposta = { cookie } as unknown as Response;

      definirCookieDeAutenticacao(
        resposta,
        'token',
        new Date('2030-01-01T00:00:00Z'),
      );

      expect(cookie).toHaveBeenCalledWith(
        COOKIE_DE_AUTENTICACAO,
        'token',
        expect.objectContaining({ sameSite: 'none', secure: true }),
      );
    });
  });

  it('limpa o cookie com as mesmas opcoes', () => {
    const clearCookie = jest.fn();
    const resposta = { clearCookie } as unknown as Response;

    limparCookieDeAutenticacao(resposta);

    expect(clearCookie).toHaveBeenCalledWith(
      COOKIE_DE_AUTENTICACAO,
      expect.objectContaining({ httpOnly: true, path: '/' }),
    );
  });
});
