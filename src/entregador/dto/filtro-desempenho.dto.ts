import { IsISO8601, IsString, Matches } from 'class-validator';

const padraoInstanteComFuso =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

export class FiltroDesempenhoDto {
  @IsString()
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(padraoInstanteComFuso, {
    message: 'de deve informar data, hora e fuso explicito',
  })
  de!: string;

  @IsString()
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(padraoInstanteComFuso, {
    message: 'ate deve informar data, hora e fuso explicito',
  })
  ate!: string;
}
