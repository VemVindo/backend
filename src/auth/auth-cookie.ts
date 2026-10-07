import type { CookieOptions, Request, Response } from 'express';

export const AUTH_COOKIE = 'vemvindo_token';

function opcoesCookie(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  };
}

export function definirCookieAuth(
  res: Response,
  tokenAcesso: string,
  expiraEm: Date,
) {
  res.cookie(AUTH_COOKIE, tokenAcesso, {
    ...opcoesCookie(),
    expires: expiraEm,
  });
}

export function limparCookieAuth(res: Response) {
  res.clearCookie(AUTH_COOKIE, opcoesCookie());
}

export function extrairTokenDoCookie(req: Request): string | null {
  const header = req?.headers?.cookie;
  if (!header) {
    return null;
  }
  for (const parte of header.split(';')) {
    const [nome, ...valor] = parte.trim().split('=');
    if (nome === AUTH_COOKIE && valor.length > 0) {
      return decodeURIComponent(valor.join('='));
    }
  }
  return null;
}
