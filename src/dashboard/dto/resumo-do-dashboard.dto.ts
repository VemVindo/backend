export interface DesempenhoDoEntregadorNoPeriodo {
  cpf: string;
  nome: string;
  totalPedidosAndamento: number;
  totalPedidosConcluidos: number;
  valorMedioEntrega: number;
}

export interface ResumoDoDashboardDto {
  idEmpresa: number;
  totalPedidos: number;
  totalPedidosPendentes: number;
  totalPedidosAndamento: number;
  totalPedidosConcluidos: number;
  totalPedidosCancelados: number;
  mediaAvaliacoes: number;
  tempoMedioEntregaMinutos: number;
  totalDistanciaPercorrida: number;
  relatorioPorEntregador: DesempenhoDoEntregadorNoPeriodo[];
}
