import { Body, Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { Cargos } from '../auth/decorators/cargos.decorator';
import { Cargo } from '../common/enums/cargo.enum';
import { UsuarioAtual } from '../auth/decorators/usuario-atual.decorator';
import type { UsuarioAutenticado } from '../auth/jwt.strategy';
import { DashboardReqDto, DashboardResDto } from './dto/dashboard.dto';

@Controller('dashboard')
@Cargos(Cargo.ESTABELECIMENTO)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  async informacoes(
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
    @Body() dashboardDto: DashboardReqDto,
  ): Promise<DashboardResDto> {
    const resultado = await this.dashboardService.montaDashboard(
      Number(usuarioAtual.empresaId),
      dashboardDto,
    );
    return resultado;
  }
}
