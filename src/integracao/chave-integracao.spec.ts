import {
  chaveConfere,
  extrairPrefixo,
  gerarChave,
  hashDaChave,
} from './chave-integracao';

describe('chave de integracao', () => {
  it('gera chave no formato vv_<prefixo>_<segredo>', () => {
    const { chave, prefixo } = gerarChave();

    expect(chave).toMatch(/^vv_[0-9a-f]{12}_[\w-]{43}$/);
    expect(extrairPrefixo(chave)).toBe(prefixo);
  });

  it('gera chaves diferentes a cada chamada', () => {
    const chaves = new Set(
      Array.from({ length: 50 }, () => gerarChave().chave),
    );
    expect(chaves.size).toBe(50);
  });

  it('guarda so o hash, que nao contem a chave', () => {
    const { chave, prefixo, hash } = gerarChave();
    // O segredo e base64url e pode ter "_": corta pelo tamanho do prefixo.
    const segredo = chave.slice(`vv_${prefixo}_`.length);

    expect(segredo).toHaveLength(43);
    expect(hash).toBe(hashDaChave(chave));
    expect(hash).not.toContain(segredo);
  });

  it('confere a chave certa e recusa uma alterada', () => {
    const { chave, hash } = gerarChave();
    const alterada = chave.slice(0, -1) + (chave.endsWith('A') ? 'B' : 'A');

    expect(chaveConfere(chave, hash)).toBe(true);
    expect(chaveConfere(alterada, hash)).toBe(false);
  });

  it.each([
    '',
    'vv_',
    'vv_xyz_abc',
    'Bearer abc',
    `vv_${'0'.repeat(12)}_curta`,
  ])('recusa formato invalido: %p', (chave) => {
    expect(extrairPrefixo(chave)).toBeNull();
  });
});
