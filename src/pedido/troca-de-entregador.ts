import { Prisma } from '../generated/prisma/client';
import { StatusPedido } from '../generated/prisma/enums';
import { EntregadorIndisponivelError } from './pedido.erros';

// Passos de escrita da troca de entregador, sempre dentro de uma transacao.
// Usados pela atribuicao/reatribuicao (E-US08, E-US11) e pela remocao do
// entregador da frota (E-US06).

export async function registrarTroca(
  tx: Prisma.TransactionClient,
  idPedido: number,
  cpfAnterior: string | null,
  cpfNovo: string,
  data: Date,
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

// So ocupa se ainda estiver disponivel: duas atribuicoes simultaneas nao
// conseguem pegar o mesmo entregador.
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

// A disponibilidade vale para todas as empresas do entregador, entao so
// volta a true quando nao sobra nenhuma entrega em andamento.
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
