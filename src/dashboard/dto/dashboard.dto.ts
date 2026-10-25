export class DashboardReqDto {
  dataInicio: string | null = null;
  dataFinal: string | null = null;
}

export class DashboardResDto {
  idEmpresa!: number;
  totalPedidos!: number | null;
  totalPedidosPendentes!: number | null;
  totalPedidosAndamento!: number | null;
  totalPedidosConcluidos!: number | null;
  totalPedidosCancelados!: number | null;
  mediaAvaliacoes!: number | null;
  tempoMediaEntrega!: number | null;
  totalDistanciaPercorrida!: number | null;
  pedidosPorEntregador!:
    | null
    | {
        cpf: string;
        nome: string;
        totalPedidosAndamento: number | null;
        totalPedidosConcluidos: number | null;
        mediaEntregas: number | null;
      }[];
}
