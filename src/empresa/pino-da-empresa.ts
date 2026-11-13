import { BadRequestException } from '@nestjs/common';
import { coordenada } from '../mapa/dto/visao-da-entrega.dto';
import { Coordenada } from '../mapa/geo';

export const MENSAGEM_PINO_INCOMPLETO =
  'Informe latitude e longitude do pino da empresa';

/** Pino marcado no mapa pela empresa: os dois valores juntos ou nenhum. */
export function pinoDaEmpresa(
  lat: number | null | undefined,
  lng: number | null | undefined,
): Coordenada | null {
  if ((lat != null) !== (lng != null)) {
    throw new BadRequestException(MENSAGEM_PINO_INCOMPLETO);
  }
  return coordenada(lat ?? null, lng ?? null);
}
