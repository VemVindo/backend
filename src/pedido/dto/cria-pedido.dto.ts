import {
  IsOptional,
  IsString,
  IsNumber,
  IsEmpty,
  IsEnum,
  IsInt,
  IsPositive,
  Min,
  IsNotEmpty,
} from 'class-validator';
import { StatusPedido } from '../../generated/prisma/enums';
import type { ModoDeViagem } from 'src/mapa/geo';

export class CriaPedidoReqDto {
  @IsEmpty()
  id_pedido!: string;

  @IsString()
  nome_recebedor!: string;

  @IsString()
  telefone_recebedor!: string;

  @IsString()
  cep!: string;

  @IsString()
  logradouro!: string;

  @IsInt()
  @IsPositive()
  numero!: number;

  @IsOptional()
  @IsString()
  complemento?: string;

  @IsString()
  bairro!: string;

  @IsString()
  cidade!: string;

  @IsString()
  uf!: string;

  @IsString()
  descricao!: string;

  @IsEmpty()
  status!: StatusPedido;

  @IsEmpty()
  data_criacao!: string;

  @IsEmpty()
  data_inicio_entrega!: string;

  @IsEmpty()
  data_finalizacao!: string;

  @IsEmpty()
  valor_entrega!: number;

  @IsInt()
  @Min(0)
  @IsEmpty()
  distancia!: number;

  @IsOptional()
  @IsString()
  cpf_entregador?: string;

  @IsNumber()
  @IsNotEmpty()
  lat_origem!: number;

  @IsNumber()
  @IsNotEmpty()
  long_origem!: number;

  @IsNumber()
  @IsNotEmpty()
  lat_destino!: number;

  @IsNumber()
  @IsNotEmpty()
  long_destino!: number;

  @IsString()
  @IsNotEmpty()
  tipo_veiculo!: ModoDeViagem;
}

export class CriaPedidoResDto {
  @IsNumber()
  id_pedido!: number;

  @IsString()
  nome_recebedor!: string;

  @IsString()
  telefone_recebedor!: string;

  @IsString()
  cep!: string;

  @IsString()
  logradouro!: string;

  @IsNumber()
  numero!: number;

  @IsOptional()
  @IsString()
  complemento?: string;

  @IsString()
  bairro!: string;

  @IsString()
  cidade!: string;

  @IsString()
  uf!: string;

  @IsString()
  descricao!: string;

  @IsEnum(StatusPedido)
  status!: StatusPedido;

  @IsString()
  data_criacao!: string;

  @IsEmpty()
  @IsString()
  data_inicio_entrega!: null;

  @IsEmpty()
  @IsString()
  data_finalizacao!: null;

  @IsNumber()
  valor_entrega!: number;

  @IsNumber()
  idEmpresa!: number;

  @IsNumber()
  distancia!: number;

  @IsOptional()
  @IsString()
  cpf_entregador?: string;
}
