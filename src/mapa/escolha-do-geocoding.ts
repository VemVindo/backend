import { Coordenada, distanciaEmMetros } from './geo';

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
  if (cep === 'diferente' || (cep === 'ausente' && !bairro)) {
    return null;
  }
  return { resultado, coordenada, cep, bairro, porta: apontaAPorta(resultado) };
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
    (candidato.bairro ? 1 : 0)
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

/** O CEP manda. Quando o Google conhece o CEP completo, o centro dele e a ancora:
 * o texto so troca a ancora por uma porta a ate RAIO_DO_CEP_M dela.
 * Sem a ancora, so vale o que tem o CEP completo ou aponta para uma porta;
 * a quadra ou a area de um resultado parcial fica de fora. Entre esses, fica com o que mais confere,
 * e so o CEP completo marca a porta como exata. No empate, vale a ordem do Google.
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
        candidato.porta &&
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
    melhor.porta && melhor.cep === 'igual' ? 'exato' : 'aproximado',
  );
}
