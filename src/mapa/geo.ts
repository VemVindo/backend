import { TipoVeiculo } from '../common/enums/tipo-veiculo.enum';

export interface Coordenada {
  lat: number;
  lng: number;
}

export const MODOS_DE_VIAGEM = ['DRIVE', 'BICYCLE'] as const;

export type ModoDeViagem = (typeof MODOS_DE_VIAGEM)[number];

export interface Trajeto {
  distanciaM: number;
  duracaoS: number;
}

const RAIO_DA_TERRA_M = 6_371_000;

const FATOR_DE_TRAJETO = 1.3;

const VELOCIDADE_MEDIA_KMH: Record<string, number> = {
  [TipoVeiculo.MOTO]: 30,
  [TipoVeiculo.CARRO]: 25,
  [TipoVeiculo.BICICLETA]: 15,
};
const VELOCIDADE_PADRAO_KMH = 25;

export const INTERVALO_MINIMO_RECALCULO_MS = 60_000;
export const INTERVALO_MAXIMO_RECALCULO_MS = 5 * 60_000;
export const DESLOCAMENTO_MINIMO_RECALCULO_M = 50;

export function distanciaEmMetros(
  origem: Coordenada,
  destino: Coordenada,
): number {
  const radianos = (graus: number) => (graus * Math.PI) / 180;
  const variacaoLat = radianos(destino.lat - origem.lat);
  const variacaoLng = radianos(destino.lng - origem.lng);
  const haversine =
    Math.sin(variacaoLat / 2) ** 2 +
    Math.cos(radianos(origem.lat)) *
      Math.cos(radianos(destino.lat)) *
      Math.sin(variacaoLng / 2) ** 2;
  return 2 * RAIO_DA_TERRA_M * Math.asin(Math.sqrt(haversine));
}

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
