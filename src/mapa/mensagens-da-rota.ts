export const MENSAGEM_SEM_ORIGEM =
  'Localização do estabelecimento não definida. Marque no mapa em Editar dados.';

export const MENSAGEM_MESMO_PONTO =
  'O pino da entrega está no mesmo ponto do estabelecimento.';

/** Com o destino conhecido, sem rota quer dizer empresa sem origem. */
export function motivoSemDistancia(rota: object | null): string {
  return rota ? MENSAGEM_MESMO_PONTO : MENSAGEM_SEM_ORIGEM;
}
