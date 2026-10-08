import { createHash, randomBytes, randomInt } from 'crypto';

const BYTES_DO_TOKEN = 32;
const FORMATO_TOKEN_BASE64URL = /^[A-Za-z0-9_-]{43}$/;
const MAIOR_CODIGO_RECEBEDOR = 1_000_000;
const DIGITOS_CODIGO_RECEBEDOR = 6;

export function gerarTokenRastreio(): string {
  return randomBytes(BYTES_DO_TOKEN).toString('base64url');
}

export function tokenComFormatoValido(token: string): boolean {
  return FORMATO_TOKEN_BASE64URL.test(token);
}

export function hashDoToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function gerarCodigoRecebedor(): string {
  return randomInt(0, MAIOR_CODIGO_RECEBEDOR)
    .toString()
    .padStart(DIGITOS_CODIGO_RECEBEDOR, '0');
}
