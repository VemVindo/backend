import {
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  Maiusculo,
  NormalizarEmail,
  Trim,
} from '../../common/transformers/texto.transformer';
import { UFS } from '../../common/constantes/ufs';

export class AtualizarCadastroDto {
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nomeFantasia: string;

  @NormalizarEmail()
  @IsEmail()
  @MaxLength(254)
  email: string;

  @Matches(/^\d{10,11}$/, {
    message: 'telefone deve ter DDD e numero, so digitos (10 ou 11)',
  })
  telefone: string;

  @Matches(/^\d{8}$/, { message: 'cep deve ter 8 digitos, sem traco' })
  cep: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  logradouro: string;

  @IsInt()
  @IsPositive()
  numero: number;

  @Trim()
  @IsString()
  @IsOptional()
  @MaxLength(100)
  complemento?: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  bairro: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  cidade: string;

  @Maiusculo()
  @IsIn(UFS, { message: 'uf deve ser a sigla de um estado brasileiro' })
  uf: string;
}
