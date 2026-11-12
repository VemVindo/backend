import { Coordenada } from './geo';

export type PrecisaoDoLocal = 'exato' | 'aproximado';

export interface EnderecoLocalizado {
  coordenada: Coordenada;
  precisao: PrecisaoDoLocal;
  enderecoEncontrado: string | null;
}

export interface EnderecoConferido {
  bairro: string;
  uf: string;
  cep: string;
}

interface ComponenteDoEndereco {
  long_name?: string;
  short_name?: string;
  types?: string[];
}

export interface ResultadoDoGeocoding {
  formatted_address?: string;
  partial_match?: boolean;
  address_components?: ComponenteDoEndereco[];
  geometry?: {
    location?: { lat?: number; lng?: number };
    location_type?: string;
  };
}

// So estes tipos apontam para a porta ou para o trecho da rua; o resto e o centro de uma area.
const LOCAIS_EXATOS = new Set(['ROOFTOP', 'RANGE_INTERPOLATED']);

// Componentes que nao dizem em que bairro o ponto esta.
const FORA_DO_BAIRRO = new Set([
  'country',
  'administrative_area_level_1',
  'postal_code',
  'route',
  'street_number',
  'premise',
  'subpremise',
]);

// "Guara 1", "Guará I" e "Setor Guará" tem de bater com o "Guará" do Google.
const PALAVRAS_GENERICAS = new Set([
  'setor',
  'bairro',
  'de',
  'da',
  'do',
  'das',
  'dos',
  'e',
]);

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function palavrasDoBairro(bairro: string): string[] {
  return normalizar(bairro)
    .split(' ')
    .filter(
      (palavra) =>
        palavra &&
        !PALAVRAS_GENERICAS.has(palavra) &&
        !/^(\d+|[ivx]+)$/.test(palavra),
    );
}

function componente(
  resultado: ResultadoDoGeocoding,
  tipo: string,
): ComponenteDoEndereco | undefined {
  return resultado.address_components?.find((parte) =>
    parte.types?.includes(tipo),
  );
}

function confereBairro(
  resultado: ResultadoDoGeocoding,
  bairro: string,
): boolean {
  const palavras = palavrasDoBairro(bairro);
  if (palavras.length === 0) {
    return false;
  }
  const regioes = new Set(
    (resultado.address_components ?? [])
      .filter((parte) => !parte.types?.some((tipo) => FORA_DO_BAIRRO.has(tipo)))
      .flatMap((parte) => normalizar(parte.long_name ?? '').split(' ')),
  );
  return palavras.every((palavra) => regioes.has(palavra));
}

function coordenadaValida(resultado: ResultadoDoGeocoding): Coordenada | null {
  const local = resultado.geometry?.location;
  return typeof local?.lat === 'number' && typeof local.lng === 'number'
    ? { lat: local.lat, lng: local.lng }
    : null;
}

interface Candidato {
  localizado: EnderecoLocalizado;
  pontos: number;
}

function outroEstado(
  resultado: ResultadoDoGeocoding,
  endereco: EnderecoConferido,
): boolean {
  const uf = componente(resultado, 'administrative_area_level_1')?.short_name;
  return uf !== undefined && uf.toUpperCase() !== endereco.uf.toUpperCase();
}

function confereCep(resultado: ResultadoDoGeocoding, cep: string): boolean {
  const cepDoResultado = (
    componente(resultado, 'postal_code')?.long_name ?? ''
  ).replace(/\D/g, '');
  return (
    cepDoResultado.length >= 5 &&
    cep.replace(/\D/g, '').startsWith(cepDoResultado.slice(0, 5))
  );
}

function apontaAPorta(resultado: ResultadoDoGeocoding): boolean {
  return (
    LOCAIS_EXATOS.has(resultado.geometry?.location_type ?? '') &&
    resultado.partial_match !== true
  );
}

function avaliar(
  resultado: ResultadoDoGeocoding,
  endereco: EnderecoConferido,
): Candidato | null {
  const coordenada = coordenadaValida(resultado);
  if (!coordenada || outroEstado(resultado, endereco)) {
    return null;
  }
  const cepConfere = confereCep(resultado, endereco.cep);
  const bairroConfere = confereBairro(resultado, endereco.bairro);
  if (!cepConfere && !bairroConfere) {
    return null;
  }
  const exato = apontaAPorta(resultado);
  return {
    localizado: {
      coordenada,
      precisao: exato ? 'exato' : 'aproximado',
      enderecoEncontrado: resultado.formatted_address ?? null,
    },
    pontos: (cepConfere ? 2 : 0) + (bairroConfere ? 1 : 0) + (exato ? 2 : 0),
  };
}

/** Escolhe o resultado que confere com a UF, o CEP ou o bairro digitados.
 * Descarta o "parecido" de outro bairro que o Google devolve quando nao acha a rua.
 * No empate, vale a ordem do Google.
 */
export function escolherResultado(
  resultados: ResultadoDoGeocoding[],
  endereco: EnderecoConferido,
): EnderecoLocalizado | null {
  let melhor: Candidato | null = null;
  for (const resultado of resultados) {
    const candidato = avaliar(resultado, endereco);
    if (candidato && (!melhor || candidato.pontos > melhor.pontos)) {
      melhor = candidato;
    }
  }
  return melhor?.localizado ?? null;
}
