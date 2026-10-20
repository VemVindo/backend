import { IsNotEmpty, IsNumber } from 'class-validator';

export class ConfigurarRemuneracaoReqDto {
  @IsNumber()
  @IsNotEmpty()
  taxa_fixa!: number;

  @IsNumber()
  @IsNotEmpty()
  coeficiente!: number;
}
