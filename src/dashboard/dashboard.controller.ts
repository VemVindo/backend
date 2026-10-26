import { Controller, Get, Query } from '@nestjs/common';
import { Cargos } from '../auth/decorators/cargos.decorator';
import { UsuarioAtual } from '../auth/decorators/usuario-atual.decorator';
import type { UsuarioAutenticado } from '../auth/jwt.strategy';
import { Cargo } from '../common/enums/cargo.enum';
import { DashboardService } from './dashboard.service';
import { FiltroDashboardDto } from './dto/filtro-dashboard.dto';
import { ResumoDoDashboardDto } from './dto/resumo-do-dashboard.dto';

@Controller('dashboard')
@Cargos(Cargo.ESTABELECIMENTO)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  consultar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Query() periodo: FiltroDashboardDto,
  ): Promise<ResumoDoDashboardDto> {
    return this.dashboardService.montarDashboard(
      Number(usuario.empresaId),
      periodo,
    );
  }
}
