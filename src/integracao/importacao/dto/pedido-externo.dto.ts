import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { UFS } from '../../../common/constantes/ufs';
import {
  Maiusculo,
  Trim,
} from '../../../common/transformers/texto.transformer';

export class PedidoExternoDto {
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nomeRecebedor: string;

  @Matches(/^\d{10,11}$/)
  telefoneRecebedor: string;

  @Matches(/^\d{8}$/)
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
  @IsOptional()
  @IsString()
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
  @IsIn(UFS)
  uf: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  descricao: string;

  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacoes?: string;
}

export const CAMPOS_DO_PEDIDO_EXTERNO: readonly (keyof PedidoExternoDto)[] = [
  'nomeRecebedor',
  'telefoneRecebedor',
  'cep',
  'logradouro',
  'numero',
  'complemento',
  'bairro',
  'cidade',
  'uf',
  'descricao',
  'observacoes',
];
