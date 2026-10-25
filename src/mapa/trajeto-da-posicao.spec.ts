import { LocalizacaoEntrega } from '../generated/prisma/client';
import { ultimoCalculo } from './trajeto-da-posicao';

const CALCULADO_EM = new Date('2026-10-15T12:00:00Z');

function anterior(extra: Partial<LocalizacaoEntrega>): LocalizacaoEntrega {
  return {
    idPedido: 42,
    lat: -15.79,
    lng: -47.88,
    precisao_m: 10,
    registrada_em: CALCULADO_EM,
    origem_rota_lat: -15.79,
    origem_rota_lng: -47.88,
    rota_polyline: null,
    distancia_restante_m: 5000,
    duracao_restante_s: 600,
    estimado: false,
    rota_calculada_em: CALCULADO_EM,
    ...extra,
  };
}

describe('ultimoCalculo', () => {
  it('sem posicao anterior nao ha calculo', () => {
    expect(ultimoCalculo(null)).toBeNull();
  });

  it('devolve a origem e a hora da ultima rota', () => {
    expect(ultimoCalculo(anterior({}))).toEqual({
      origem: { lat: -15.79, lng: -47.88 },
      calculadoEm: CALCULADO_EM,
    });
  });

  it.each([
    ['latitude', { origem_rota_lat: null }],
    ['longitude', { origem_rota_lng: null }],
  ])('sem %s de origem a rota fica sem origem', (_campo, extra) => {
    expect(ultimoCalculo(anterior(extra))?.origem).toBeNull();
  });
});
