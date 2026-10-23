import { LocalizacaoEntrega } from '../../generated/prisma/client';
import { StatusPedido } from '../../generated/prisma/enums';
import {
  DISTANCIA_PROXIMO_M,
  montarVisao,
  visaoDoRecebedor,
} from './visao-da-entrega.dto';

const PONTOS = {
  status: StatusPedido.EM_ANDAMENTO,
  origem: { lat: -15.8, lng: -47.89 },
  destino: { lat: -15.81, lng: -47.9 },
};

function localizacao(distancia: number | null) {
  return {
    idPedido: 1,
    lat: -15.805,
    lng: -47.895,
    precisao_m: 10,
    registrada_em: new Date('2026-10-20T12:00:00Z'),
    distancia_restante_m: distancia,
    duracao_restante_s: 60,
    estimado: false,
    rota_polyline: null,
    origem_rota_lat: null,
    origem_rota_lng: null,
    rota_calculada_em: null,
  } as LocalizacaoEntrega;
}

describe('montarVisao: entregador proximo (R-US04)', () => {
  it.each([
    [DISTANCIA_PROXIMO_M, true],
    [DISTANCIA_PROXIMO_M + 1, false],
    [null, false],
  ])('com %s m restantes marca proximo = %s', (distancia, proximo) => {
    expect(montarVisao(PONTOS, localizacao(distancia)).entregadorProximo).toBe(
      proximo,
    );
  });

  it('sem posicao do entregador nao esta proximo', () => {
    expect(montarVisao(PONTOS, null).entregadorProximo).toBe(false);
  });

  it('entrega encerrada nao avisa proximidade', () => {
    const visao = montarVisao(
      { ...PONTOS, status: StatusPedido.FINALIZADO },
      localizacao(50),
    );
    expect(visao.entregadorProximo).toBe(false);
  });

  it('o aviso continua com o mapa desligado, sem coordenadas', () => {
    const visao = visaoDoRecebedor(
      montarVisao(PONTOS, localizacao(100)),
      false,
    );

    expect(visao.entregadorProximo).toBe(true);
    expect(visao.entregador).toBeNull();
  });
});
