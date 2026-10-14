import { IsEnum } from 'class-validator';
import { StatusPedido } from '../../generated/prisma/enums';

export class AtualizarStatusPedidoDto {
  @IsEnum(StatusPedido, {
    message: 'Status de pedido inválido',
  })
  status: StatusPedido;
}
