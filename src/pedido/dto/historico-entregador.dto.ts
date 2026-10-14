import type { RegistroHistoricoEntregador } from '../pedido.repository';

// Expoe so o nome: a empresa mantem o historico dos pedidos dela mesmo apos o
// desvinculo, mas nao os dados pessoais do entregador.
export interface HistoricoEntregadorDto {
  anterior: string | null;
  novo: string;
  data: Date;
}

export function paraHistoricoEntregador(
  registro: RegistroHistoricoEntregador,
): HistoricoEntregadorDto {
  return {
    anterior: registro.entregadorAntigo?.nome ?? null,
    novo: registro.entregadorNovo.nome,
    data: registro.data,
  };
}
