import { Injectable } from '@nestjs/common';
import { StatusPedido } from '../generated/prisma/enums';
import {
  DashboardRepository,
  DuracaoDaEntrega,
  EntregadorComPedidos,
  FiltroDoDashboard,
} from './dashboard.repository';
import { FiltroDashboardDto } from './dto/filtro-dashboard.dto';
import {
  DesempenhoDoEntregadorNoPeriodo,
  ResumoDoDashboardDto,
} from './dto/resumo-do-dashboard.dto';

const MILISSEGUNDOS_POR_MINUTO = 60_000;

function media(valores: number[]): number {
  if (valores.length === 0) return 0;
  return valores.reduce((soma, valor) => soma + valor, 0) / valores.length;
}

// O repositorio so devolve entregas com inicio e fim preenchidos.
function tempoMedioEmMinutos(duracoes: DuracaoDaEntrega[]): number {
  const duracoesEmMs = duracoes.map(
    (duracao) =>
      duracao.data_finalizacao!.getTime() -
      duracao.data_inicio_entrega!.getTime(),
  );
  return media(duracoesEmMs) / MILISSEGUNDOS_POR_MINUTO;
}

function desempenhoNoPeriodo({
  cpf,
  nome,
  pedidos,
}: EntregadorComPedidos): DesempenhoDoEntregadorNoPeriodo {
  const valoresConcluidos = pedidos
    .filter((pedido) => pedido.status === StatusPedido.FINALIZADO)
    .map((pedido) => pedido.valor_entrega);
  return {
    cpf,
    nome,
    totalPedidosAndamento: pedidos.length - valoresConcluidos.length,
    totalPedidosConcluidos: valoresConcluidos.length,
    valorMedioEntrega: Number(media(valoresConcluidos).toFixed(2)),
  };
}

@Injectable()
export class DashboardService {
  constructor(private readonly dashboard: DashboardRepository) {}

  async montarDashboard(
    idEmpresa: number,
    periodo: FiltroDashboardDto,
  ): Promise<ResumoDoDashboardDto> {
    const filtro: FiltroDoDashboard = { idEmpresa, ...periodo };
    const [
      totalPedidos,
      totalPedidosPendentes,
      totalPedidosAndamento,
      totalPedidosConcluidos,
      totalPedidosCancelados,
      mediaAvaliacoes,
      duracoes,
      totalDistanciaPercorrida,
      entregadores,
    ] = await Promise.all([
      this.dashboard.contarPedidos(filtro),
      this.dashboard.contarPedidos(filtro, StatusPedido.PENDENTE),
      this.dashboard.contarPedidos(filtro, StatusPedido.EM_ANDAMENTO),
      this.dashboard.contarPedidos(filtro, StatusPedido.FINALIZADO),
      this.dashboard.contarPedidos(filtro, StatusPedido.CANCELADO),
      this.dashboard.mediaDasAvaliacoes(filtro),
      this.dashboard.listarDuracoesDeEntrega(filtro),
      this.dashboard.somarDistanciaPercorrida(filtro),
      this.dashboard.listarEntregadoresAtivos(filtro),
    ]);

    return {
      idEmpresa,
      totalPedidos,
      totalPedidosPendentes,
      totalPedidosAndamento,
      totalPedidosConcluidos,
      totalPedidosCancelados,
      mediaAvaliacoes: mediaAvaliacoes ?? 0,
      tempoMedioEntregaMinutos: tempoMedioEmMinutos(duracoes),
      totalDistanciaPercorrida,
      relatorioPorEntregador: entregadores.map(desempenhoNoPeriodo),
    };
  }
}
