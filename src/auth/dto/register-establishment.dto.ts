import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class RegisterEstablishmentDto {
  @IsString()
  @IsNotEmpty()
  nomeFantasia: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  telefone: string;

  // Documento e CNPJ ou CPF. A regra de exigir ao menos um fica no service.
  @IsString()
  @IsOptional()
  cnpj?: string;

  @IsString()
  @IsOptional()
  cpf?: string;

  // Obrigatoria apenas quando o documento e CNPJ (validado no service).
  @IsString()
  @IsOptional()
  razaoSocial?: string;

  @IsString()
  @IsNotEmpty()
  cep: string;

  @IsString()
  @IsNotEmpty()
  logradouro: string;

  @IsInt()
  numero: number;

  @IsString()
  @IsOptional()
  complemento?: string;

  @IsString()
  @IsNotEmpty()
  bairro: string;

  @IsString()
  @IsNotEmpty()
  cidade: string;

  @IsString()
  @IsNotEmpty()
  uf: string;

  @IsString()
  @MinLength(8)
  senha: string;
}
