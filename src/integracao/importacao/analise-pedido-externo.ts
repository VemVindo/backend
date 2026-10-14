import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import type { Prisma } from '../../generated/prisma/client';
import {
  CAMPOS_DO_PEDIDO_EXTERNO,
  PedidoExternoDto,
} from './dto/pedido-externo.dto';

const FORMATO_ID_EXTERNO = /^[\w.:-]{1,100}$/;

export type DadosPedidoExterno = Partial<
  Record<keyof PedidoExternoDto, Prisma.InputJsonValue>
>;

export interface AnalisePedidoExterno {
  dados: DadosPedidoExterno;
  pedido: PedidoExternoDto;
  camposFaltantes: string[];
}

export function ehObjetoSimples(
  valor: unknown,
): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

export function idExternoValido(valor: unknown): valor is string {
  return typeof valor === 'string' && FORMATO_ID_EXTERNO.test(valor);
}

export function analisarPedidoExterno(
  entrada: Record<string, unknown>,
): AnalisePedidoExterno {
  const pedido = plainToInstance(
    PedidoExternoDto,
    apenasCamposConhecidos(entrada),
  );
  const camposFaltantes = validateSync(pedido).map((erro) => erro.property);
  return { dados: apenasCamposConhecidos(pedido), pedido, camposFaltantes };
}

function apenasCamposConhecidos(origem: object): DadosPedidoExterno {
  const valores = origem as Record<string, Prisma.InputJsonValue>;
  return Object.fromEntries(
    CAMPOS_DO_PEDIDO_EXTERNO.filter(
      (campo) => valores[campo] !== undefined,
    ).map((campo) => [campo, valores[campo]]),
  );
}
