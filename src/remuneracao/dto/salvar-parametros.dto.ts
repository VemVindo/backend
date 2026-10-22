import { IsInt, Max, Min } from 'class-validator';

// Centavos; o limite e o do Int do Postgres.
const MAX_CENTAVOS = 2_147_483_647;

export class SalvarParametrosDto {
  @IsInt({ message: 'taxaFixa deve ser um valor inteiro em centavos' })
  @Min(1, { message: 'taxaFixa deve ser maior que zero' })
  @Max(MAX_CENTAVOS, { message: 'taxaFixa excede o limite permitido' })
  taxaFixa: number;

  @IsInt({ message: 'coeficienteKm deve ser um valor inteiro em centavos' })
  @Min(1, { message: 'coeficienteKm deve ser maior que zero' })
  @Max(MAX_CENTAVOS, { message: 'coeficienteKm excede o limite permitido' })
  coeficienteKm: number;
}
