import { StatusPedido } from '../../generated/prisma/enums';
import { linhaDoTempo, MarcoDoPedido } from '../../rastreio/linha-do-tempo';
import type { PedidoComEntregador } from '../pedido.repository';

// E-US13: o que a empresa ve no detalhe de um pedido dela.
export interface DetalheDoPedidoDto {
  id: number;
  status: StatusPedido;
  descricao: string;
  recebedor: { nome: string; telefone: string };
  endereco: {
    cep: string;
    logradouro: string;
    numero: number;
    complemento: string | null;
    bairro: string;
    cidade: string;
    uf: string;
  };
  entregador: string | null;
  valorEntrega: number;
  ganhoConsolidadoCentavos: number | null;
  distanciaConhecida: boolean | null;
  distancia: number;
  criadoEm: Date;
  linhaDoTempo: MarcoDoPedido[];
}

export function paraDetalheDoPedido(
  pedido: PedidoComEntregador,
): DetalheDoPedidoDto {
  return {
    id: pedido.id_pedido,
    status: pedido.status,
    descricao: pedido.descricao,
    recebedor: {
      nome: pedido.nome_recebedor,
      telefone: pedido.telefone_recebedor,
    },
    endereco: {
      cep: pedido.cep,
      logradouro: pedido.logradouro,
      numero: pedido.numero,
      complemento: pedido.complemento,
      bairro: pedido.bairro,
      cidade: pedido.cidade,
      uf: pedido.uf,
    },
    entregador: pedido.entregador?.nome ?? null,
    valorEntrega: pedido.valor_entrega,
    ganhoConsolidadoCentavos: pedido.ganho_consolidado_centavos ?? null,
    distanciaConhecida: pedido.distancia_conhecida ?? null,
    distancia: pedido.distancia,
    criadoEm: pedido.data_criacao,
    linhaDoTempo: linhaDoTempo(pedido),
  };
}
