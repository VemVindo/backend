import { Injectable } from '@nestjs/common';
import { DashboardReqDto, DashboardResDto } from './dto/dashboard.dto';
import { DashboardRepository } from './dashboard.repository';

@Injectable()
export class DashboardService {

  constructor(private readonly dashboardRepository: DashboardRepository) {}
  async montaDashboard(
    idEmpresa: number,
    dashboarDto: DashboardReqDto,
  ): DashboardResDto {
    //validacao do periodo
    this.dashboardRepository.definirAtributos(idEmpresa, dashboarDto);
    const data: DashboardResDto = {
      idEmpresa: idEmpresa,
      totalPedidos: await this.dashboardRepository.totalPedidos(),
      totalPedidosPendentes:
        await this.dashboardRepository.totalPedidosPendentes(),
      totalPedidosAndamento:
        await this.dashboardRepository.totalPedidosAndamento(),
      totalPedidosConcluidos:
        await this.dashboardRepository.totalPedidosConcluidos(),
      totalPedidosCancelados:
        await this.dashboardRepository.totalPedidosCancelados(),
      mediaAvaliacoes: await this.dashboardRepository.mediaAvaliacoes(),
      tempoMediaEntrega: await this.dashboardRepository.tempoMedioEntrega(),
      totalDistanciaPercorrida: await this.dashboardRepository.totalDistanciaPercorrida(),
      pedidosPorEntregador: await this.dashboardRepository.pedidosPorEntregador(),
    };
    return data;
  }
}
