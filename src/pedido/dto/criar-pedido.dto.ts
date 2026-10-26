import {
  IsEmpty,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';
import { StatusPedido } from '../../generated/prisma/enums';
import { MODOS_DE_VIAGEM, type ModoDeViagem } from '../../mapa/geo';

export class CriarPedidoDto {
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

  @IsOptional()
  @IsString()
  cpf_entregador?: string;

  @IsIn(MODOS_DE_VIAGEM)
  tipo_veiculo!: ModoDeViagem;
}

export class PedidoCriadoDto {
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
