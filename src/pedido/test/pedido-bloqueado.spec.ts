import { Prisma } from '../../generated/prisma/client';
import { bloquearPedido } from '../pedido-bloqueado';
import { PedidoAlteradoError } from '../pedido.erros';

const ID_PEDIDO = 42;

function montar(linhasBloqueadas: { id_pedido: number }[]) {
  const pedido = { id_pedido: ID_PEDIDO };
  const clienteTransacional = {
    $queryRaw: jest.fn().mockResolvedValue(linhasBloqueadas),
    pedido: { findUniqueOrThrow: jest.fn().mockResolvedValue(pedido) },
  };
  return {
    cliente: clienteTransacional as unknown as Prisma.TransactionClient,
    clienteTransacional,
    pedido,
  };
}

describe('bloquearPedido', () => {
  it('trava a linha e devolve o pedido atual', async () => {
    const { cliente, clienteTransacional, pedido } = montar([
      { id_pedido: ID_PEDIDO },
    ]);

    await expect(bloquearPedido(cliente, ID_PEDIDO)).resolves.toBe(pedido);
    expect(clienteTransacional.pedido.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id_pedido: ID_PEDIDO },
    });
  });

  it('falha com PedidoAlteradoError quando o pedido sumiu', async () => {
    const { cliente, clienteTransacional } = montar([]);

    await expect(bloquearPedido(cliente, ID_PEDIDO)).rejects.toThrow(
      PedidoAlteradoError,
    );
    expect(clienteTransacional.pedido.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});
