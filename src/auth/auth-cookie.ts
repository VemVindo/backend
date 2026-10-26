import type { CookieOptions, Request, Response } from 'express';

export const COOKIE_DE_AUTENTICACAO = 'vemvindo_token';

function opcoesCookie(): CookieOptions {
  const politicaSameSite =
    process.env.COOKIE_SAMESITE === 'none' ? 'none' : 'lax';
  return {
    httpOnly: true,
    secure:
      politicaSameSite === 'none' || process.env.NODE_ENV === 'production',
    sameSite: politicaSameSite,
    path: '/',
  };
}

export function definirCookieDeAutenticacao(
  resposta: Response,
  tokenAcesso: string,
  expiraEm: Date,
) {
  resposta.cookie(COOKIE_DE_AUTENTICACAO, tokenAcesso, {
    ...opcoesCookie(),
    expires: expiraEm,
  });
}

export function limparCookieDeAutenticacao(resposta: Response) {
  resposta.clearCookie(COOKIE_DE_AUTENTICACAO, opcoesCookie());
}

export function extrairTokenDoCookie(requisicao: Request): string | null {
  const cabecalho = requisicao?.headers?.cookie;
  if (!cabecalho) {
    return null;
  }
  for (const parte of cabecalho.split(';')) {
    const [nome, ...valor] = parte.trim().split('=');
    if (nome === COOKIE_DE_AUTENTICACAO && valor.length > 0) {
      return decodeURIComponent(valor.join('='));
    }
  }
  return null;
}
