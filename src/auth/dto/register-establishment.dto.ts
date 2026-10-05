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
  MinLength,
} from 'class-validator';
import {
  Maiusculo,
  NormalizarEmail,
  Trim,
} from '../../common/transformers/texto.transformer';
import {
  TAMANHO_MAXIMO_SENHA_BCRYPT,
  TAMANHO_MINIMO_SENHA,
} from '../../common/security/senha.constants';
import { IsCnpj } from '../../common/validators/is-cnpj.validator';
import { IsCpf } from '../../common/validators/is-cpf.validator';

const UFS = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
];

export class RegisterEstablishmentDto {
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

  @Maiusculo()
  @IsOptional()
  @IsCnpj()
  cnpj?: string;

  @IsOptional()
  @IsCpf()
  cpf?: string;

  @Trim()
  @IsString()
  @IsOptional()
  @MaxLength(150)
  razaoSocial?: string;

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

  @IsString()
  @MinLength(TAMANHO_MINIMO_SENHA)
  @MaxLength(TAMANHO_MAXIMO_SENHA_BCRYPT)
  senha: string;
}
