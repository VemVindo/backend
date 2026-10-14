import { createHash, randomBytes, timingSafeEqual } from 'crypto';

const BYTES_DO_PREFIXO = 6;
const BYTES_DO_SEGREDO = 32;
const FORMATO_CHAVE = /^vv_([0-9a-f]{12})_[A-Za-z0-9_-]{43}$/;

export interface ChaveGerada {
  chave: string;
  prefixo: string;
  hash: string;
}

export function gerarChave(): ChaveGerada {
  const prefixo = randomBytes(BYTES_DO_PREFIXO).toString('hex');
  const segredo = randomBytes(BYTES_DO_SEGREDO).toString('base64url');
  const chave = `vv_${prefixo}_${segredo}`;
  return { chave, prefixo, hash: hashDaChave(chave) };
}

export function extrairPrefixo(chave: string): string | null {
  return FORMATO_CHAVE.exec(chave)?.[1] ?? null;
}

export function hashDaChave(chave: string): string {
  return createHash('sha256').update(chave).digest('hex');
}

export function chaveConfere(chave: string, hash: string): boolean {
  const esperado = Buffer.from(hash, 'hex');
  const recebido = Buffer.from(hashDaChave(chave), 'hex');
  return (
    esperado.length === recebido.length && timingSafeEqual(esperado, recebido)
  );
}
