import {
  deveRecalcularRota,
  distanciaEmMetros,
  estimarTrajeto,
  modoDeViagem,
} from './geo';

// Pontos publicos de Brasilia, so para as contas.
const ESPLANADA = { lat: -15.7939, lng: -47.8828 };
// Uns 15 m da Esplanada: variacao normal do GPS com o entregador parado.
const AO_LADO = { lat: -15.794, lng: -47.8829 };
const PARQUE_DA_CIDADE = { lat: -15.8, lng: -47.9 };
const AGORA = new Date('2026-10-15T12:00:00Z');

function segundosAntes(segundos: number): Date {
  return new Date(AGORA.getTime() - segundos * 1000);
}

describe('distanciaEmMetros', () => {
  it('e zero para o mesmo ponto', () => {
    expect(distanciaEmMetros(ESPLANADA, ESPLANADA)).toBe(0);
  });

  it('mede um grau de latitude em cerca de 111 km', () => {
    const distancia = distanciaEmMetros({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(distancia).toBeGreaterThan(111_000);
    expect(distancia).toBeLessThan(111_400);
  });
});

describe('estimarTrajeto', () => {
  it('soma 30% a linha reta e usa a velocidade do veiculo', () => {
    const linhaReta = distanciaEmMetros(ESPLANADA, PARQUE_DA_CIDADE);

    const moto = estimarTrajeto(ESPLANADA, PARQUE_DA_CIDADE, 'MOTO');
    const bicicleta = estimarTrajeto(ESPLANADA, PARQUE_DA_CIDADE, 'BICICLETA');

    expect(moto.distanciaM).toBe(Math.round(linhaReta * 1.3));
    expect(moto.duracaoS).toBe(Math.round(moto.distanciaM / (30 / 3.6)));
    expect(bicicleta.duracaoS).toBeGreaterThan(moto.duracaoS);
  });

  it('usa uma velocidade padrao para veiculo desconhecido', () => {
    const trajeto = estimarTrajeto(ESPLANADA, PARQUE_DA_CIDADE, 'PATINETE');
    expect(trajeto.duracaoS).toBe(Math.round(trajeto.distanciaM / (25 / 3.6)));
  });
});

describe('modoDeViagem', () => {
  it('bicicleta pede rota de bicicleta e o resto de carro', () => {
    expect(modoDeViagem('BICICLETA')).toBe('BICYCLE');
    expect(modoDeViagem('MOTO')).toBe('DRIVE');
    expect(modoDeViagem('CARRO')).toBe('DRIVE');
  });
});

describe('deveRecalcularRota', () => {
  it('calcula quando ainda nao houve calculo', () => {
    expect(deveRecalcularRota(null, ESPLANADA, AGORA)).toBe(true);
    expect(
      deveRecalcularRota({ origem: null, calculadoEm: null }, ESPLANADA, AGORA),
    ).toBe(true);
  });

  it('espera um minuto entre calculos, mesmo com o entregador andando', () => {
    const ultimo = { origem: ESPLANADA, calculadoEm: segundosAntes(59) };
    expect(deveRecalcularRota(ultimo, PARQUE_DA_CIDADE, AGORA)).toBe(false);
  });

  it('recalcula depois de um minuto se o entregador saiu do lugar', () => {
    const ultimo = { origem: ESPLANADA, calculadoEm: segundosAntes(60) };
    expect(deveRecalcularRota(ultimo, PARQUE_DA_CIDADE, AGORA)).toBe(true);
  });

  it('com o entregador parado, so recalcula depois de cinco minutos', () => {
    const recente = { origem: ESPLANADA, calculadoEm: segundosAntes(120) };
    const antigo = { origem: ESPLANADA, calculadoEm: segundosAntes(300) };

    expect(deveRecalcularRota(recente, AO_LADO, AGORA)).toBe(false);
    expect(deveRecalcularRota(antigo, AO_LADO, AGORA)).toBe(true);
  });
});
