import { Body, Controller, Get, Put } from '@nestjs/common';
import { Cargos } from '../auth/decorators/cargos.decorator';
import { UsuarioAtual } from '../auth/decorators/usuario-atual.decorator';
import type { UsuarioAutenticado } from '../auth/jwt.strategy';
import { Cargo } from '../common/enums/cargo.enum';
import { SalvarParametrosDto } from './dto/salvar-parametros.dto';
import { RemuneracaoService } from './remuneracao.service';

@Controller('empresa/remuneracao')
@Cargos(Cargo.ESTABELECIMENTO)
export class RemuneracaoController {
  constructor(private readonly remuneracaoService: RemuneracaoService) {}

  @Get()
  consultar(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.remuneracaoService.consultar(Number(usuario.empresaId));
  }

  @Put()
  salvar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Body() dto: SalvarParametrosDto,
  ) {
    return this.remuneracaoService.salvar(Number(usuario.empresaId), {
      taxaFixa: dto.taxaFixa,
      coeficienteKm: dto.coeficienteKm,
    });
  }
}
