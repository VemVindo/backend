import { Prisma } from '../generated/prisma/client';
import { StatusPedido } from '../generated/prisma/enums';
import { EntregadorIndisponivelError } from './pedido.erros';

export interface TrocaDeEntregador {
  idPedido: number;
  cpfAnterior: string | null;
  cpfNovo: string;
  data: Date;
}

export async function registrarTroca(
  tx: Prisma.TransactionClient,
  { idPedido, cpfAnterior, cpfNovo, data }: TrocaDeEntregador,
): Promise<void> {
  await tx.historicoPedidoEntregadores.create({
    data: {
      id_pedido: idPedido,
      cpf_entregador_antigo: cpfAnterior,
      cpf_entregador_novo: cpfNovo,
      data,
    },
  });
}

export async function tentarOcuparEntregador(
  tx: Prisma.TransactionClient,
  cpfEntregador: string,
): Promise<boolean> {
  const { count } = await tx.entregador.updateMany({
    where: { cpf: cpfEntregador, disponivel: true },
    data: { disponivel: false },
  });
  return count > 0;
}

export async function ocuparEntregador(
  tx: Prisma.TransactionClient,
  cpfEntregador: string,
): Promise<void> {
  if (!(await tentarOcuparEntregador(tx, cpfEntregador))) {
    throw new EntregadorIndisponivelError();
  }
}

export async function liberarSeOcioso(
  tx: Prisma.TransactionClient,
  cpfEntregador: string,
): Promise<void> {
  const emAndamento = await tx.pedido.count({
    where: {
      cpf_entregador: cpfEntregador,
      status: StatusPedido.EM_ANDAMENTO,
    },
  });
  if (emAndamento === 0) {
    await tx.entregador.update({
      where: { cpf: cpfEntregador },
      data: { disponivel: true },
    });
  }
}
