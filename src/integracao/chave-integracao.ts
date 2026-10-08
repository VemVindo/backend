import { createHash, randomBytes, timingSafeEqual } from 'crypto';

// Formato: vv_<prefixo>_<segredo>. O prefixo (12 hex) identifica a credencial e
// pode aparecer na tela; o segredo (256 bits em base64url) so e exibido na geracao.
const FORMATO_CHAVE = /^vv_([0-9a-f]{12})_[A-Za-z0-9_-]{43}$/;

export interface ChaveGerada {
  chave: string;
  prefixo: string;
  hash: string;
}

export function gerarChave(): ChaveGerada {
  const prefixo = randomBytes(6).toString('hex');
  const segredo = randomBytes(32).toString('base64url');
  const chave = `vv_${prefixo}_${segredo}`;
  return { chave, prefixo, hash: hashDaChave(chave) };
}

export function extrairPrefixo(chave: string): string | null {
  return FORMATO_CHAVE.exec(chave)?.[1] ?? null;
}

// Com 256 bits aleatorios nao ha senha fraca para adivinhar: SHA-256 basta e
// evita o custo do bcrypt, ja que a chave e conferida a cada requisicao.
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
