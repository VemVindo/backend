import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { SalvarParametrosDto } from './salvar-parametros.dto';

function campos(dados: object) {
  const dto = plainToInstance(SalvarParametrosDto, {
    taxaFixa: 800,
    coeficienteKm: 150,
    ...dados,
  });
  return validateSync(dto).map((e) => e.property);
}

describe('SalvarParametrosDto', () => {
  it('aceita valores inteiros e positivos em centavos', () => {
    expect(campos({})).toEqual([]);
  });

  it.each([
    ['zero', 0],
    ['negativo', -1],
    ['fracao de centavo', 8.5],
    ['texto', '800'],
    ['acima do Int do banco', 2_147_483_648],
  ])('recusa %s', (_caso, valor) => {
    expect(campos({ taxaFixa: valor, coeficienteKm: valor })).toEqual([
      'taxaFixa',
      'coeficienteKm',
    ]);
  });
});
