import type { RegistroHistoricoEntregador } from '../pedido.repository';

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
