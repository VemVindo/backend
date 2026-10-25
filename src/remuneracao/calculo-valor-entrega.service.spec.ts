import { BadRequestException } from '@nestjs/common';
import {
  CalculoValorEntregaService,
  type DadosCalculoValorEntrega,
} from './calculo-valor-entrega.service';

const casosValidos = [
  [4200, 800, 150, 1430],
  [1000, 200, 300, 500],
  [2500, 100, 200, 600],
  [0, 800, 150, 800],
  [4200, 0, 150, 630],
  [4200, 800, 0, 800],
  [0, 0, 0, 0],
  [1234, 800, 150, 985],
  [1, 0, 499, 0],
  [1, 0, 500, 1],
  [1, 0, 501, 1],
  [3, 10, 500, 12],
  [1000, 2_147_483_646, 1, 2_147_483_647],
  [1, 2_147_483_647, 499, 2_147_483_647],
  [Number.MAX_SAFE_INTEGER, 1, 0, 1],
  [0, 0, Number.MAX_SAFE_INTEGER, 0],
  [1, 0, 2_147_483_647_000, 2_147_483_647],
];

function dados(
  distanciaMetros: number,
  taxaFixaCentavos: number,
  coeficienteCentavosKm: number,
): DadosCalculoValorEntrega {
  return { distanciaMetros, taxaFixaCentavos, coeficienteCentavosKm };
}

describe('CalculoValorEntregaService', () => {
  const service = new CalculoValorEntregaService();

  it.each(casosValidos)(
    'calcula %i metros com taxa %i e coeficiente %i como %i centavos',
    (distancia, taxa, coeficiente, esperado) => {
      const resultado = service.calcularValorEntrega(
        dados(distancia, taxa, coeficiente),
      );
      expect(resultado).toBe(esperado);
      expect(Number.isSafeInteger(resultado)).toBe(true);
    },
  );

  const valoresInvalidos: unknown[] = [
    -1,
    0.5,
    NaN,
    Infinity,
    -Infinity,
    undefined,
    null,
    '1000',
    true,
    {},
    [],
    1n,
    Number.MAX_SAFE_INTEGER + 1,
    -Number.MAX_SAFE_INTEGER - 1,
  ];
  const campos = [
    'distanciaMetros',
    'taxaFixaCentavos',
    'coeficienteCentavosKm',
  ] as const;

  it.each(
    campos.flatMap((campo) =>
      valoresInvalidos.map((valor) => ({ campo, valor })),
    ),
  )('rejeita $campo com valor $valor', ({ campo, valor }) => {
    const entrada = { ...dados(4200, 800, 150), [campo]: valor };
    expect(() => service.calcularValorEntrega(entrada)).toThrow(
      BadRequestException,
    );
  });

  it.each(campos)('rejeita o campo ausente %s', (campo) => {
    const entrada: Partial<DadosCalculoValorEntrega> = dados(4200, 800, 150);
    delete entrada[campo];
    expect(() =>
      service.calcularValorEntrega(entrada as DadosCalculoValorEntrega),
    ).toThrow(BadRequestException);
  });

  it.each([undefined, null, 'dados', 1, true, [], {}])(
    'rejeita objeto de entrada invalido %p',
    (entrada) => {
      expect(() =>
        service.calcularValorEntrega(entrada as DadosCalculoValorEntrega),
      ).toThrow(BadRequestException);
    },
  );

  it.each([
    [0, 2_147_483_648, 0],
    [1000, 2_147_483_647, 1],
    [1, 2_147_483_647, 500],
    [Number.MAX_SAFE_INTEGER, 0, Number.MAX_SAFE_INTEGER],
    [1000, Number.MAX_SAFE_INTEGER, 1],
  ])('rejeita resultado excedente para %i, %i, %i', (distancia, taxa, coef) => {
    expect(() =>
      service.calcularValorEntrega(dados(distancia, taxa, coef)),
    ).toThrow(BadRequestException);
  });

  it.each(casosValidos)(
    'preserva a entrada e e deterministico para %i, %i, %i',
    (distancia, taxa, coeficiente, esperado) => {
      const entrada = Object.freeze(dados(distancia, taxa, coeficiente));
      const original = { ...entrada };
      expect(service.calcularValorEntrega(entrada)).toBe(esperado);
      expect(service.calcularValorEntrega(entrada)).toBe(esperado);
      expect(entrada).toEqual(original);
    },
  );
});
