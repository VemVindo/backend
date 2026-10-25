import { Body, Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { Cargos } from 'src/auth/decorators/cargos.decorator';
import { Cargo } from 'src/common/enums/cargo.enum';
import { UsuarioAtual } from 'src/auth/decorators/usuario-atual.decorator';
import type { UsuarioAutenticado } from 'src/auth/jwt.strategy';
import { DashboardReqDto, DashboardResDto } from './dto/dashboard.dto';

@Controller('dashboard')
@Cargos(Cargo.ESTABELECIMENTO)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  informacoes(
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
    @Body() dashboardDto: DashboardReqDto,
  ): DashboardResDto {
    const resultado = this.dashboardService.montaDashboard(
      Number(usuarioAtual.empresaId),
      dashboardDto,
    );
    return resultado;
  }
}
