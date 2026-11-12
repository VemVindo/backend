import type { ResultadoDoGeocoding } from './escolha-do-geocoding';

const TIPOS_DO_LOGRADOURO = new Set([
  'route',
  'street_number',
  'premise',
  'subpremise',
]);

const PALAVRAS_GENERICAS_DO_LOGRADOURO = new Set([
  'rua',
  'r',
  'avenida',
  'av',
  'quadra',
  'q',
  'setor',
  'conjunto',
  'lote',
  'bloco',
  'bl',
  'casa',
]);

export type Conferencia = 'confere' | 'ausente' | 'diferente';

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function palavrasDoLogradouro(logradouro: string): string[] {
  return normalizar(logradouro)
    .split(' ')
    .filter(
      (palavra) => palavra && !PALAVRAS_GENERICAS_DO_LOGRADOURO.has(palavra),
    );
}

export function conferirLogradouro(
  resultado: ResultadoDoGeocoding,
  logradouro: string | undefined,
): Conferencia {
  if (!logradouro) {
    return 'confere';
  }
  const esperadas = palavrasDoLogradouro(logradouro);
  if (esperadas.length === 0) {
    return 'confere';
  }
  const dadosDoEndereco = (resultado.address_components ?? [])
    .filter((parte) =>
      parte.types?.some((tipo) => TIPOS_DO_LOGRADOURO.has(tipo)),
    )
    .map((parte) => parte.long_name ?? '')
    .join(' ');
  const textoDoEndereco = dadosDoEndereco.trim()
    ? dadosDoEndereco
    : (resultado.formatted_address ?? '');
  const encontradas = new Set(normalizar(textoDoEndereco).split(' '));
  const quantidadeEncontrada = esperadas.filter((palavra) =>
    encontradas.has(palavra),
  ).length;
  if (quantidadeEncontrada === esperadas.length) {
    return 'confere';
  }
  return quantidadeEncontrada > 0 || dadosDoEndereco.trim().length > 0
    ? 'diferente'
    : 'ausente';
}

export function conferirNumero(
  resultado: ResultadoDoGeocoding,
  numero: number | undefined,
): Conferencia {
  if (numero === undefined) {
    return 'confere';
  }
  const encontrado = resultado.address_components?.find((parte) =>
    parte.types?.includes('street_number'),
  )?.long_name;
  if (encontrado === undefined) {
    return 'ausente';
  }
  return encontrado.replace(/\D/g, '') === String(numero)
    ? 'confere'
    : 'diferente';
}
