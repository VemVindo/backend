import { TipoVeiculo } from '../common/enums/tipo-veiculo.enum';

export interface Coordenada {
  lat: number;
  lng: number;
}

export type ModoDeViagem = 'DRIVE' | 'BICYCLE';

export interface Trajeto {
  distanciaM: number;
  duracaoS: number;
}

const RAIO_DA_TERRA_M = 6_371_000;

// Ruas nao sao linha reta: a distancia real costuma ficar uns 30% acima.
const FATOR_DE_TRAJETO = 1.3;

const VELOCIDADE_MEDIA_KMH: Record<string, number> = {
  [TipoVeiculo.MOTO]: 30,
  [TipoVeiculo.CARRO]: 25,
  [TipoVeiculo.BICICLETA]: 15,
};
const VELOCIDADE_PADRAO_KMH = 25;

// A rota so e recalculada no Google depois desse intervalo e se o entregador
// saiu do lugar; parado, so a cada INTERVALO_MAXIMO. Isso limita o custo.
export const INTERVALO_MINIMO_RECALCULO_MS = 60_000;
export const INTERVALO_MAXIMO_RECALCULO_MS = 5 * 60_000;
export const DESLOCAMENTO_MINIMO_RECALCULO_M = 50;

export function distanciaEmMetros(a: Coordenada, b: Coordenada): number {
  const radianos = (graus: number) => (graus * Math.PI) / 180;
  const dLat = radianos(b.lat - a.lat);
  const dLng = radianos(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radianos(a.lat)) *
      Math.cos(radianos(b.lat)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * RAIO_DA_TERRA_M * Math.asin(Math.sqrt(h));
}

// Usado quando o Google nao responde ou nao ha chave configurada.
export function estimarTrajeto(
  origem: Coordenada,
  destino: Coordenada,
  tipoVeiculo: string,
): Trajeto {
  const distanciaM = Math.round(
    distanciaEmMetros(origem, destino) * FATOR_DE_TRAJETO,
  );
  const velocidadeMs =
    ((VELOCIDADE_MEDIA_KMH[tipoVeiculo] ?? VELOCIDADE_PADRAO_KMH) * 1000) /
    3600;
  return { distanciaM, duracaoS: Math.round(distanciaM / velocidadeMs) };
}

const BICICLETA: string = TipoVeiculo.BICICLETA;

export function modoDeViagem(tipoVeiculo: string): ModoDeViagem {
  return tipoVeiculo === BICICLETA ? 'BICYCLE' : 'DRIVE';
}

export interface UltimoCalculo {
  origem: Coordenada | null;
  calculadoEm: Date | null;
}

export function deveRecalcularRota(
  ultimo: UltimoCalculo | null,
  posicao: Coordenada,
  agora: Date,
): boolean {
  if (!ultimo?.calculadoEm || !ultimo.origem) {
    return true;
  }
  const decorrido = agora.getTime() - ultimo.calculadoEm.getTime();
  if (decorrido < INTERVALO_MINIMO_RECALCULO_MS) {
    return false;
  }
  if (decorrido >= INTERVALO_MAXIMO_RECALCULO_MS) {
    return true;
  }
  return (
    distanciaEmMetros(ultimo.origem, posicao) >= DESLOCAMENTO_MINIMO_RECALCULO_M
  );
}
