import { ehObjetoSimples, idExternoValido } from './analise-pedido-externo';

const MOTIVO_ITEM_NAO_E_OBJETO = 'Pedido deve ser um objeto';
const MOTIVO_ID_EXTERNO_INVALIDO =
  'idExterno obrigatorio: ate 100 letras, numeros, _ . : ou -';

export type ResultadoInvalido = {
  idExterno: null;
  situacao: 'invalido';
  motivo: string;
};

export type ResultadoImportacao =
  | { idExterno: string; situacao: 'importado'; idPedido: number }
  | {
      idExterno: string;
      situacao: 'incompleto';
      idPendencia: number;
      camposFaltantes: string[];
    }
  | { idExterno: string; situacao: 'duplicado' }
  | ResultadoInvalido;

export interface ItemDoLote {
  idExterno: string;
  campos: Record<string, unknown>;
}

export function lerItemDoLote(item: unknown): ItemDoLote | ResultadoInvalido {
  if (!ehObjetoSimples(item)) {
    return invalido(MOTIVO_ITEM_NAO_E_OBJETO);
  }
  const { idExterno, ...campos } = item;
  if (!idExternoValido(idExterno)) {
    return invalido(MOTIVO_ID_EXTERNO_INVALIDO);
  }
  return { idExterno, campos };
}

function invalido(motivo: string): ResultadoInvalido {
  return { idExterno: null, situacao: 'invalido', motivo };
}

export function resumir(resultados: ResultadoImportacao[]) {
  const contar = (situacao: ResultadoImportacao['situacao']) =>
    resultados.filter((resultado) => resultado.situacao === situacao).length;
  return {
    recebidos: resultados.length,
    importados: contar('importado'),
    incompletos: contar('incompleto'),
    duplicados: contar('duplicado'),
    invalidos: contar('invalido'),
  };
}
