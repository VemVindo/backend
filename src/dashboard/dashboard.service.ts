import { Injectable } from '@nestjs/common';
import { DashboardReqDto, DashboardResDto } from './dto/dashboard.dto';
import { DashboardRepository } from './dashboard.repository';
import { StatusPedido } from '../generated/prisma';

@Injectable()
export class DashboardService {
  constructor(private readonly dashboardRepository: DashboardRepository) {}

  async montaDashboard(
    idEmpresa: number,
    dashboardDto: DashboardReqDto,
  ): Promise<DashboardResDto> {
    this.dashboardRepository.definirAtributos(idEmpresa, dashboardDto);

    const [
      totalPedidos,
      totalPedidosPendentes,
      totalPedidosAndamento,
      totalPedidosConcluidos,
      totalPedidosCancelados,
      mediaAvaliacoes,
      tempoMediaEntrega,
      totalDistanciaPercorrida,
      relatorioPorEntregador,
    ] = await Promise.all([
      this.totalPedidos(),
      this.totalPedidosPendentes(),
      this.totalPedidosAndamento(),
      this.totalPedidosConcluidos(),
      this.totalPedidosCancelados(),
      this.mediaAvaliacoes(),
      this.tempoMedioEntrega(),
      this.totalDistanciaPercorrida(),
      this.relatorioPorEntregador(),
    ]);

    const data: DashboardResDto = {
      idEmpresa,
      totalPedidos,
      totalPedidosPendentes,
      totalPedidosAndamento,
      totalPedidosConcluidos,
      totalPedidosCancelados,
      mediaAvaliacoes,
      tempoMediaEntrega,
      totalDistanciaPercorrida,
      relatorioPorEntregador,
    };

    return data;
  }

  private async totalPedidos(): Promise<number> {
    const resultado = await this.dashboardRepository.totalPedidos();
    return resultado.length;
  }

  private async totalPedidosPendentes(): Promise<number> {
    const resultado = await this.dashboardRepository.totalPedidosPendentes();
    return resultado.length;
  }

  private async totalPedidosAndamento(): Promise<number> {
    const resultado = await this.dashboardRepository.totalPedidosAndamento();
    return resultado.length;
  }

  private async totalPedidosConcluidos(): Promise<number> {
    const resultado = await this.dashboardRepository.totalPedidosConcluidos();
    return resultado.length;
  }

  private async totalPedidosCancelados(): Promise<number> {
    const resultado = await this.dashboardRepository.totalPedidosCancelados();
    return resultado.length;
  }

  private async mediaAvaliacoes(): Promise<number> {
    const resultado = await this.dashboardRepository.avaliacoes();
    if (resultado.length === 0) return 0;
    const tamanho = resultado.length;
    let notas = 0;
    resultado.forEach((r) => {
      notas += r.avaliacao_entrega;
    });
    return notas / tamanho;
  }

  private async tempoMedioEntrega(): Promise<number> {
    const resultado = await this.dashboardRepository.tempoMedioEntrega();

    if (resultado.length === 0) return 0;

    let somatorioTempoMs = 0;

    resultado.forEach((r) => {
      const inicio = new Date(r.data_inicio_entrega!).getTime();
      const fim = new Date(r.data_finalizacao!).getTime();

      const tempoEntregaMs = fim - inicio;
      somatorioTempoMs += tempoEntregaMs;
    });

    const mediaMs = somatorioTempoMs / resultado.length;
    const mediaMinutos = mediaMs / (1000 * 60);

    return mediaMinutos;
  }

  private async totalDistanciaPercorrida(): Promise<number | null> {
    const resultado = await this.dashboardRepository.totalDistanciaPercorrida();

    if (resultado.length === 0) return null;
    let distancia = 0;
    resultado.forEach((r) => {
      distancia += r.distancia;
    });

    return distancia;
  }

  private async relatorioPorEntregador() {
    const entregadores =
      await this.dashboardRepository.relatorioPorEntregador();

    if (entregadores.length === 0) return null;

    const relatorio = entregadores.map((entregador) => {
      let pedidosEmAndamento = 0;
      let pedidosConcluidos = 0;
      let somatorioValorConcluidos = 0;

      entregador.pedidos.forEach((pedido) => {
        if (pedido.status === StatusPedido.FINALIZADO) {
          pedidosConcluidos++;
          somatorioValorConcluidos += Number(pedido.valor_entrega);
        } else {
          pedidosEmAndamento++;
        }
      });

      const valorMedio =
        pedidosConcluidos > 0
          ? somatorioValorConcluidos / pedidosConcluidos
          : 0;

      return {
        nome: entregador.nome,
        cpf: entregador.cpf,
        totalPedidosAndamento: pedidosEmAndamento,
        totalPedidosConcluidos: pedidosConcluidos,
        mediaEntregas: Number(valorMedio.toFixed(2)),
      };
    });

    return relatorio;
  }
}
