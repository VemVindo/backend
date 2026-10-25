import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CorrigirDistanciaDto } from './corrigir-distancia.dto';

describe('CorrigirDistanciaDto', () => {
  it.each([0, 4200, 2147483647])(
    'aceita distancia conhecida %s',
    (distancia) => {
      expect(
        validateSync(
          plainToInstance(CorrigirDistanciaDto, {
            distanciaMetros: distancia,
          }),
        ),
      ).toEqual([]);
    },
  );
  it.each([undefined, null, -1, 1.5, '1000', Infinity, NaN, 2147483648])(
    'recusa distancia invalida %s',
    (distancia) => {
      expect(
        validateSync(
          plainToInstance(CorrigirDistanciaDto, {
            distanciaMetros: distancia,
          }),
        ),
      ).toHaveLength(1);
    },
  );
});
