import { IsEnum } from 'class-validator';
import { StatusPedido } from '../../common/enums/status-pedido.enum';

export class AtualizarStatusPedidoDto {
  @IsEnum(StatusPedido, {
    message: 'Status de pedido inválido',
  })
  status: StatusPedido;
}