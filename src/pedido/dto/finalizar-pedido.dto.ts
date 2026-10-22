import { Matches } from 'class-validator';

export class FinalizarPedidoDto {
  @Matches(/^\d{6}$/, { message: 'O código do recebedor tem 6 números' })
  codigo: string;
}
