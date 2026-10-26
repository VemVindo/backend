import { LocalizacaoEntrega } from '../../generated/prisma/client';
import { StatusPedido } from '../../generated/prisma/enums';
import { Coordenada } from '../geo';
import type { PedidoComMapa } from '../localizacao.repository';

export const DISTANCIA_PROXIMO_M = 300;

export interface VisaoDaEntrega {
  status: StatusPedido;
  exibirMapa: boolean;
  origem: Coordenada | null;
  destino: Coordenada | null;
  entregador: (Coordenada & { precisaoM: number | null }) | null;
  rota: string | null;
  distanciaRestanteM: number | null;
  duracaoRestanteS: number | null;
  estimado: boolean;
  entregadorProximo: boolean;
  atualizadaEm: Date | null;
}

export function coordenada(lat: number | null, lng: number | null) {
  return lat === null || lng === null ? null : { lat, lng };
}

export function destinoDoPedido(pedido: PedidoComMapa): Coordenada | null {
  return coordenada(pedido.destino_lat, pedido.destino_lng);
}

export function origemDaEmpresa(pedido: PedidoComMapa): Coordenada | null {
  return coordenada(pedido.empresa.origem_lat, pedido.empresa.origem_lng);
}

export interface PontosDaEntrega {
  status: StatusPedido;
  origem: Coordenada | null;
  destino: Coordenada | null;
}

const SEM_LOCALIZACAO = {
  exibirMapa: true,
  entregador: null,
  rota: null,
  distanciaRestanteM: null,
  duracaoRestanteS: null,
  estimado: true,
  entregadorProximo: false,
  atualizadaEm: null,
} satisfies Omit<VisaoDaEntrega, keyof PontosDaEntrega>;

export function montarVisao(
  pontos: PontosDaEntrega,
  localizacao: LocalizacaoEntrega | null,
): VisaoDaEntrega {
  if (!localizacao) {
    return { ...pontos, ...SEM_LOCALIZACAO };
  }
  const distancia = localizacao.distancia_restante_m;
  return {
    ...pontos,
    exibirMapa: true,
    entregador: {
      lat: localizacao.lat,
      lng: localizacao.lng,
      precisaoM: localizacao.precisao_m,
    },
    rota: localizacao.rota_polyline,
    distanciaRestanteM: distancia,
    duracaoRestanteS: localizacao.duracao_restante_s,
    estimado: localizacao.estimado,
    entregadorProximo:
      pontos.status === StatusPedido.EM_ANDAMENTO &&
      distancia !== null &&
      distancia <= DISTANCIA_PROXIMO_M,
    atualizadaEm: localizacao.registrada_em,
  };
}

export function visaoDoRecebedor(
  visao: VisaoDaEntrega,
  exibirMapa: boolean,
): VisaoDaEntrega {
  if (exibirMapa) {
    return visao;
  }
  return {
    ...visao,
    exibirMapa: false,
    origem: null,
    destino: null,
    entregador: null,
    rota: null,
  };
}
