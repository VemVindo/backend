import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { FiltroDesempenhoDto } from './filtro-desempenho.dto';

describe('FiltroDesempenhoDto', () => {
  const periodoValido = {
    de: '2026-10-01T00:00:00-03:00',
    ate: '2026-11-01T03:00:00.000Z',
  };

  it('aceita instantes com offset ou UTC', () => {
    expect(
      validateSync(plainToInstance(FiltroDesempenhoDto, periodoValido)),
    ).toEqual([]);
  });

  it.each([
    undefined,
    null,
    '',
    '2026-10-01',
    '2026-10-01T00:00:00',
    '2026-02-30T00:00:00Z',
    '2026-10-01T25:00:00Z',
    '2026-10-01T00:00:00+25:00',
    '2026-10-01T00:00:00.0001Z',
    ['2026-10-01T00:00:00Z', '2026-10-02T00:00:00Z'],
    123,
    {},
  ])(
    'rejeita datas invalidas, ausentes ou repetidas: %p',
    (valorFiltroInvalido) => {
      for (const campoPeriodo of ['de', 'ate']) {
        const filtroPeriodo = plainToInstance(FiltroDesempenhoDto, {
          ...periodoValido,
          [campoPeriodo]: valorFiltroInvalido,
        });
        expect(
          validateSync(filtroPeriodo).some(
            (erroValidacao) => erroValidacao.property === campoPeriodo,
          ),
        ).toBe(true);
      }
    },
  );
});
