import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { UserRole } from '../common/enums/user-role.enum';
import { CadastrarEntregadorDto } from './dto/cadastrar-entregador.dto';
import { VincularEntregadorDto } from './dto/vincular-entregador.dto';
import { EntregadorService } from './entregador.service';

@Controller('entregadores')
@Roles(UserRole.ESTABELECIMENTO)
export class EntregadorController {
  constructor(private readonly entregadorService: EntregadorService) {}

  @Post()
  cadastrar(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CadastrarEntregadorDto,
  ) {
    return this.entregadorService.cadastrar(Number(user.establishmentId), dto);
  }

  @Post('vinculo')
  @HttpCode(200)
  vincular(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VincularEntregadorDto,
  ) {
    return this.entregadorService.vincular(Number(user.establishmentId), dto.cpf);
  }

  @Get()
  listarFrota(@CurrentUser() user: AuthenticatedUser) {
    return this.entregadorService.listarFrota(Number(user.establishmentId));
  }
}
