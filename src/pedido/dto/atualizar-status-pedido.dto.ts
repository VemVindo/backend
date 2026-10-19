import { IsEnum } from 'class-validator';
import { StatusPedido } from '../../generated/prisma';

export class AtualizarStatusPedidoDto {
  @IsEnum(StatusPedido, {
    message: 'Status de pedido inválido',
  })
  status: StatusPedido;
}
