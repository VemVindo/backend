import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class AtualizarEntregadorPedidoReqDto {
  @IsNumber()
  @IsNotEmpty()
  id_empresa!: number;

  @IsNumber()
  @IsNotEmpty()
  id_pedido!: number;

  @IsString()
  @IsNotEmpty()
  cpf_entregador!: string;
}
