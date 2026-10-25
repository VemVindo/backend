import { Pedido } from '../generated/prisma/client';
import { StatusPedido } from '../generated/prisma/enums';

export type EtapaDoPedido = 'CRIADO' | StatusPedido;

export interface MarcoDoPedido {
  etapa: EtapaDoPedido;
  em: Date;
}

type DatasDoPedido = Pick<
  Pedido,
  'status' | 'data_criacao' | 'data_inicio_entrega' | 'data_finalizacao'
>;

export function linhaDoTempo(pedido: DatasDoPedido): MarcoDoPedido[] {
  const marcos: MarcoDoPedido[] = [
    { etapa: 'CRIADO', em: pedido.data_criacao },
  ];
  if (pedido.data_inicio_entrega) {
    marcos.push({
      etapa: StatusPedido.EM_ANDAMENTO,
      em: pedido.data_inicio_entrega,
    });
  }
  if (pedido.data_finalizacao) {
    marcos.push({ etapa: pedido.status, em: pedido.data_finalizacao });
  }
  return marcos;
}
