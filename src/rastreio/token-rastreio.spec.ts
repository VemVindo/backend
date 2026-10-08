import {
  gerarCodigoRecebedor,
  gerarTokenRastreio,
  hashDoToken,
  tokenComFormatoValido,
} from './token-rastreio';

describe('token de rastreio', () => {
  it('gera token de 43 caracteres que cabe na URL', () => {
    const token = gerarTokenRastreio();

    expect(token).toMatch(/^[\w-]{43}$/);
    expect(tokenComFormatoValido(token)).toBe(true);
    expect(encodeURIComponent(token)).toBe(token);
  });

  it('gera tokens diferentes a cada chamada', () => {
    const tokens = new Set(
      Array.from({ length: 50 }, () => gerarTokenRastreio()),
    );
    expect(tokens.size).toBe(50);
  });

  it('guarda so o hash, que nao contem o token', () => {
    const token = gerarTokenRastreio();
    const hash = hashDoToken(token);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
    expect(hashDoToken(token)).toBe(hash);
  });

  it.each(['', 'curto', 'a'.repeat(44), `${'a'.repeat(42)}!`, '../../etc'])(
    'recusa formato invalido: %p',
    (token) => {
      expect(tokenComFormatoValido(token)).toBe(false);
    },
  );

  it('gera codigo do recebedor com 6 digitos, com zeros a esquerda', () => {
    for (let i = 0; i < 200; i++) {
      expect(gerarCodigoRecebedor()).toMatch(/^\d{6}$/);
    }
  });
});
