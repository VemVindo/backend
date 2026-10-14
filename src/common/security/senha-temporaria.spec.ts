import {
  expiracaoSenhaTemporaria,
  senhaTemporariaExpirada,
} from './senha-temporaria';

describe('senha temporaria', () => {
  const agora = new Date('2026-10-07T12:00:00Z');

  it('vale 48 horas a partir de agora', () => {
    expect(expiracaoSenhaTemporaria(agora)).toEqual(
      new Date('2026-10-09T12:00:00Z'),
    );
  });

  it('expira no instante do prazo', () => {
    expect(
      senhaTemporariaExpirada(new Date('2026-10-07T12:00:01Z'), agora),
    ).toBe(false);
    expect(senhaTemporariaExpirada(agora, agora)).toBe(true);
  });

  it('sem prazo gravado conta como expirada', () => {
    expect(senhaTemporariaExpirada(null, agora)).toBe(true);
  });
});
