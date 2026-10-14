import { ArrayMaxSize, ArrayNotEmpty, IsArray } from 'class-validator';

export const LIMITE_PEDIDOS_POR_IMPORTACAO = 100;

export class ImportarPedidosDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(LIMITE_PEDIDOS_POR_IMPORTACAO)
  pedidos: unknown[];
}
