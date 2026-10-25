import { Pedido, Prisma } from '../generated/prisma/client';
import { PedidoAlteradoError } from './pedido.erros';

export const COM_NOME_DO_ENTREGADOR = {
  entregador: { select: { nome: true } },
} satisfies Prisma.PedidoInclude;

export async function bloquearPedido(
  clienteTransacional: Prisma.TransactionClient,
  idPedido: number,
): Promise<Pedido> {
  const pedidosBloqueados = await clienteTransacional.$queryRaw<
    { id_pedido: number }[]
  >`
    SELECT id_pedido FROM "Pedido" WHERE id_pedido = ${idPedido} FOR UPDATE
  `;
  if (pedidosBloqueados.length === 0) throw new PedidoAlteradoError();
  return clienteTransacional.pedido.findUniqueOrThrow({
    where: { id_pedido: idPedido },
  });
}

export function recarregarComEntregador(
  clienteTransacional: Prisma.TransactionClient,
  idPedido: number,
) {
  return clienteTransacional.pedido.findUniqueOrThrow({
    where: { id_pedido: idPedido },
    include: COM_NOME_DO_ENTREGADOR,
  });
}
