import type { CookieOptions, Request, Response } from 'express';

export const AUTH_COOKIE = 'vemvindo_token';

// 'none' quando front e API ficam em sites diferentes (ex.: dois *.onrender.com,
// que estao na Public Suffix List); com 'lax' o navegador nao enviaria o cookie.
// O navegador so aceita SameSite=None com Secure.
function opcoesCookie(): CookieOptions {
  const sameSite = process.env.COOKIE_SAMESITE === 'none' ? 'none' : 'lax';
  return {
    httpOnly: true,
    secure: sameSite === 'none' || process.env.NODE_ENV === 'production',
    sameSite,
    path: '/',
  };
}

export function definirCookieAuth(
  res: Response,
  accessToken: string,
  expiraEm: Date,
) {
  res.cookie(AUTH_COOKIE, accessToken, {
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
