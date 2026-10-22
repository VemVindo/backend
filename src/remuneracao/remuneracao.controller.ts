import { Body, Controller, Post } from '@nestjs/common';
import { Cargos } from '../auth/decorators/cargos.decorator';
import { UsuarioAtual } from '../auth/decorators/usuario-atual.decorator';
import type { UsuarioAutenticado } from '../auth/jwt.strategy';
import { Cargo } from '../common/enums/cargo.enum';
import { ConfigurarRemuneracaoReqDto } from './dto/configurar-remuneracao.dto';
import { RemuneracaoService } from './remuneracao.service';

@Controller('remuneracao')
export class RemuneracaoController {
  constructor(private readonly remuneracaoService: RemuneracaoService) {}

  @Post()
  @Cargos(Cargo.ESTABELECIMENTO)
  async configurarRemuneracao(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Body() configurarRemuneracaoDto: ConfigurarRemuneracaoReqDto,
  ): Promise<boolean> {
    const result = await this.remuneracaoService.configurarRemuneracao(
      Number(usuario.empresaId),
      configurarRemuneracaoDto,
    );
    return result;
  }
}
