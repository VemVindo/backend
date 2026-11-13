import { IsInt, IsPositive, IsString } from 'class-validator';

export class LocalizarEnderecoDto {
  @IsString()
  cep!: string;

  @IsString()
  logradouro!: string;

  @IsInt()
  @IsPositive()
  numero!: number;

  @IsString()
  bairro!: string;

  @IsString()
  cidade!: string;

  @IsString()
  uf!: string;
}
