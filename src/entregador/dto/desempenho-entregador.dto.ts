export interface DesempenhoEntregadorDto {
  cpf_entregador: string;
  periodo: { de: string; ate: string };
  total_entregas: number;
  tempo_medio_entrega_segundos: number | null;
  entregas_com_tempo_valido: number;
  entregas_sem_tempo_valido: number;
  avaliacao_media: number | null;
  total_avaliacoes: number;
  distancia_total_metros: number | null;
  distancia_conhecida_metros: number | null;
  entregas_com_distancia_conhecida: number;
  entregas_com_distancia_desconhecida: number;
}

export type IndicadoresDesempenho = Omit<
  DesempenhoEntregadorDto,
  'cpf_entregador' | 'periodo'
>;
