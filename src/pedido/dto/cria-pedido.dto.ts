import { IsOptional, IsString, IsNumber, IsEmpty } from 'class-validator';

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

  @IsEmpty()
  status!: string;

  @IsEmpty()
  data_criacao!: string;

  @IsEmpty()
  data_inicio_entrega!: string;

  @IsEmpty()
  data_finalizacao!: string;

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

  @IsString()
  status!: string;

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
