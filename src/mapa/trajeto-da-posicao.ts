import { LocalizacaoEntrega } from '../generated/prisma/client';
import { Coordenada, Trajeto } from './geo';
import { RotaCalculada } from './google-maps.client';
import { DadosDaPosicao } from './localizacao.repository';

export type TrajetoDaPosicao = Omit<
  DadosDaPosicao,
  'lat' | 'lng' | 'precisao_m' | 'registrada_em'
>;

export const SEM_TRAJETO: TrajetoDaPosicao = {
  origem_rota_lat: null,
  origem_rota_lng: null,
  rota_polyline: null,
  distancia_restante_m: null,
  duracao_restante_s: null,
  estimado: true,
  rota_calculada_em: null,
};

export function ultimoCalculo(anterior: LocalizacaoEntrega | null) {
  if (!anterior) {
    return null;
  }
  const origem =
    anterior.origem_rota_lat !== null && anterior.origem_rota_lng !== null
      ? { lat: anterior.origem_rota_lat, lng: anterior.origem_rota_lng }
      : null;
  return { origem, calculadoEm: anterior.rota_calculada_em };
}

export function trajetoRecalculado(
  rota: RotaCalculada | null,
  estimativa: Trajeto,
  origem: Coordenada,
  agora: Date,
): TrajetoDaPosicao {
  return {
    ...trajeto(rota ?? estimativa, rota?.polyline ?? null, !rota),
    origem_rota_lat: origem.lat,
    origem_rota_lng: origem.lng,
    rota_calculada_em: agora,
  };
}

export function trajetoEstimado(
  estimativa: Trajeto,
  anterior: LocalizacaoEntrega | null,
  posicao: Coordenada,
): TrajetoDaPosicao {
  return {
    ...trajeto(estimativa, null, true),
    origem_rota_lat: anterior?.origem_rota_lat ?? posicao.lat,
    origem_rota_lng: anterior?.origem_rota_lng ?? posicao.lng,
    rota_calculada_em: anterior?.rota_calculada_em ?? null,
  };
}

export function dadosDaRota(anterior: LocalizacaoEntrega): TrajetoDaPosicao {
  return {
    origem_rota_lat: anterior.origem_rota_lat,
    origem_rota_lng: anterior.origem_rota_lng,
    rota_polyline: anterior.rota_polyline,
    distancia_restante_m: anterior.distancia_restante_m,
    duracao_restante_s: anterior.duracao_restante_s,
    estimado: anterior.estimado,
    rota_calculada_em: anterior.rota_calculada_em,
  };
}

function trajeto(valores: Trajeto, polyline: string | null, estimado: boolean) {
  return {
    rota_polyline: polyline,
    distancia_restante_m: valores.distanciaM,
    duracao_restante_s: valores.duracaoS,
    estimado,
  };
}
