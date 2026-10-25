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

export function montarVisao(
  { status, origem, destino }: PontosDaEntrega,
  localizacao: LocalizacaoEntrega | null,
): VisaoDaEntrega {
  const distancia = localizacao?.distancia_restante_m ?? null;
  return {
    status,
    exibirMapa: true,
    origem,
    destino,
    entregador: localizacao && {
      lat: localizacao.lat,
      lng: localizacao.lng,
      precisaoM: localizacao.precisao_m,
    },
    rota: localizacao?.rota_polyline ?? null,
    distanciaRestanteM: distancia,
    duracaoRestanteS: localizacao?.duracao_restante_s ?? null,
    estimado: localizacao?.estimado ?? true,
    entregadorProximo:
      status === StatusPedido.EM_ANDAMENTO &&
      distancia !== null &&
      distancia <= DISTANCIA_PROXIMO_M,
    atualizadaEm: localizacao?.registrada_em ?? null,
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
