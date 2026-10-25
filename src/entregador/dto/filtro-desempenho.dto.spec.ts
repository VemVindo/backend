import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { FiltroDesempenhoDto } from './filtro-desempenho.dto';

describe('FiltroDesempenhoDto', () => {
  const periodo_valido = {
    de: '2026-10-01T00:00:00-03:00',
    ate: '2026-11-01T03:00:00.000Z',
  };

  it('aceita instantes com offset ou UTC', () => {
    expect(
      validateSync(plainToInstance(FiltroDesempenhoDto, periodo_valido)),
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
    (valor_filtro_invalido) => {
      for (const campo_periodo of ['de', 'ate']) {
        const filtro_periodo = plainToInstance(FiltroDesempenhoDto, {
          ...periodo_valido,
          [campo_periodo]: valor_filtro_invalido,
        });
        expect(
          validateSync(filtro_periodo).some(
            (erro_validacao) => erro_validacao.property === campo_periodo,
          ),
        ).toBe(true);
      }
    },
  );
});
