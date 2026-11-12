import { Coordenada, distanciaEmMetros } from './geo';
import { conferirLogradouro, conferirNumero } from './conferencia-do-endereco';
import type { Conferencia } from './conferencia-do-endereco';

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
  logradouro?: string;
  numero?: number;
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

// A porta so substitui o centro do CEP se cair a ate essa distancia dele.
export const RAIO_DO_CEP_M = 300;

// O CEP completo aponta para um trecho de rua ou um conjunto; os 5 primeiros digitos, para uma regiao inteira.
type CepDoResultado = 'igual' | 'mesma-regiao' | 'ausente' | 'diferente';
type CepAceito = Exclude<CepDoResultado, 'diferente'>;

// O CEP completo vale mais que porta e bairro juntos.
const PONTOS_DO_CEP: Record<CepAceito, number> = {
  igual: 6,
  'mesma-regiao': 2,
  ausente: 0,
};

interface Candidato {
  resultado: ResultadoDoGeocoding;
  coordenada: Coordenada;
  cep: CepAceito;
  bairro: boolean;
  porta: boolean;
  logradouro: Conferencia;
  numero: Conferencia;
}

function outroEstado(
  resultado: ResultadoDoGeocoding,
  endereco: EnderecoConferido,
): boolean {
  const uf = componente(resultado, 'administrative_area_level_1')?.short_name;
  return uf !== undefined && uf.toUpperCase() !== endereco.uf.toUpperCase();
}

function conferirCep(
  resultado: ResultadoDoGeocoding,
  cep: string,
): CepDoResultado {
  const digitado = cep.replace(/\D/g, '');
  const doResultado = (
    componente(resultado, 'postal_code')?.long_name ?? ''
  ).replace(/\D/g, '');
  if (doResultado.length === 8) {
    return doResultado === digitado ? 'igual' : 'diferente';
  }
  if (doResultado.length >= 5) {
    return digitado.startsWith(doResultado.slice(0, 5))
      ? 'mesma-regiao'
      : 'diferente';
  }
  return 'ausente';
}

function apontaAPorta(resultado: ResultadoDoGeocoding): boolean {
  return (
    LOCAIS_EXATOS.has(resultado.geometry?.location_type ?? '') &&
    resultado.partial_match !== true
  );
}

/** Descarta o que cai em outro estado ou com outro CEP. Sem CEP, so vale se o bairro conferir. */
function avaliar(
  resultado: ResultadoDoGeocoding,
  endereco: EnderecoConferido,
): Candidato | null {
  const coordenada = coordenadaValida(resultado);
  if (!coordenada || outroEstado(resultado, endereco)) {
    return null;
  }
  const cep = conferirCep(resultado, endereco.cep);
  const bairro = confereBairro(resultado, endereco.bairro);
  const logradouro = conferirLogradouro(resultado, endereco.logradouro);
  const numero = conferirNumero(resultado, endereco.numero);
  if (
    cep === 'diferente' ||
    (cep === 'ausente' && !bairro) ||
    logradouro === 'diferente' ||
    numero === 'diferente'
  ) {
    return null;
  }
  return {
    resultado,
    coordenada,
    cep,
    bairro,
    porta: apontaAPorta(resultado),
    logradouro,
    numero,
  };
}

function avaliarTodos(
  resultados: ResultadoDoGeocoding[],
  endereco: EnderecoConferido,
): Candidato[] {
  return resultados
    .map((resultado) => avaliar(resultado, endereco))
    .filter((candidato) => candidato !== null);
}

function localizado(
  candidato: Candidato,
  precisao: PrecisaoDoLocal,
  prefixo = '',
): EnderecoLocalizado {
  const texto = candidato.resultado.formatted_address;
  return {
    coordenada: candidato.coordenada,
    precisao,
    enderecoEncontrado: texto ? `${prefixo}${texto}` : null,
  };
}

function pontos(candidato: Candidato): number {
  return (
    PONTOS_DO_CEP[candidato.cep] +
    (candidato.porta ? 2 : 0) +
    (candidato.bairro ? 1 : 0) +
    (candidato.logradouro === 'confere' ? 1 : 0) +
    (candidato.numero === 'confere' ? 1 : 0)
  );
}

function enderecoConfere(candidato: Candidato): boolean {
  return (
    candidato.porta &&
    candidato.logradouro === 'confere' &&
    candidato.numero === 'confere'
  );
}

function maisConfere(candidatos: Candidato[]): Candidato | null {
  let melhor: Candidato | null = null;
  for (const candidato of candidatos) {
    if (!melhor || pontos(candidato) > pontos(melhor)) {
      melhor = candidato;
    }
  }
  return melhor;
}

/** O CEP completo ancora a busca: so troca pelo ponto do texto com rua e numero conferidos
 * dentro de RAIO_DO_CEP_M. Sem a ancora, so vale o CEP completo ou uma porta sem conflito
 * de rua/numero; resultado parcial de outra quadra fica de fora.
 */
export function escolherResultado(
  porCep: ResultadoDoGeocoding[],
  porTexto: ResultadoDoGeocoding[],
  endereco: EnderecoConferido,
): EnderecoLocalizado | null {
  const doCep = avaliarTodos(porCep, endereco);
  const doTexto = avaliarTodos(porTexto, endereco);
  const centroDoCep = doCep.find((candidato) => candidato.cep === 'igual');
  if (centroDoCep) {
    const porta = doTexto.find(
      (candidato) =>
        enderecoConfere(candidato) &&
        distanciaEmMetros(candidato.coordenada, centroDoCep.coordenada) <=
          RAIO_DO_CEP_M,
    );
    return porta
      ? localizado(porta, 'exato')
      : localizado(centroDoCep, 'aproximado', 'Área do CEP: ');
  }
  const melhor = maisConfere(
    [...doTexto, ...doCep].filter(
      (candidato) => candidato.cep === 'igual' || candidato.porta,
    ),
  );
  if (!melhor) {
    return null;
  }
  return localizado(
    melhor,
    melhor.cep === 'igual' && enderecoConfere(melhor) ? 'exato' : 'aproximado',
  );
}
