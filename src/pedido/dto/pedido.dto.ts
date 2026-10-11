import { IsOptional, IsString, IsNumber } from 'class-validator';

export class PedidoDto {
  @IsOptional()
  @IsNumber()
  id_pedido?: number;

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

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  data_criacao?: string;

  @IsOptional()
  @IsString()
  data_inicio_entrega?: string;

  @IsOptional()
  @IsString()
  data_finalizacao?: string;

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
