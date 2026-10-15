import { LocalizacaoEntrega } from '../../generated/prisma/client';
import { StatusPedido } from '../../generated/prisma/enums';
import { Coordenada } from '../geo';
import type { PedidoComMapa } from '../localizacao.repository';

// Distancia em metros e duracao em segundos. "estimado" indica que o valor
// veio da linha reta, nao do calculo de rota do Google.
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
  atualizadaEm: Date | null;
}

function coordenada(lat: number | null, lng: number | null) {
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
    distanciaRestanteM: localizacao?.distancia_restante_m ?? null,
    duracaoRestanteS: localizacao?.duracao_restante_s ?? null,
    estimado: localizacao?.estimado ?? true,
    atualizadaEm: localizacao?.registrada_em ?? null,
  };
}

// Com o mapa desligado pela empresa, o recebedor ve so distancia e tempo:
// nenhuma coordenada sai do servidor.
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
