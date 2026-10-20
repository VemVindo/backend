import { Body, Controller, Post } from '@nestjs/common';
import { Cargos } from 'src/auth/decorators/cargos.decorator';
import { UsuarioAtual } from 'src/auth/decorators/usuario-atual.decorator';
import type { UsuarioAutenticado } from 'src/auth/jwt.strategy';
import { Cargo } from 'src/common/enums/cargo.enum';
import { ConfigurarRemuneracaoReqDto } from './dto/configurar-remuneracao.dto';
import { RemuneracaoService } from './remuneracao.service';

@Controller('remuneracao')
export class RemuneracaoController {
  constructor(private readonly remuneracaoService: RemuneracaoService) {}

  @Post()
  @Cargos(Cargo.ESTABELECIMENTO)
  async configurarTaxaFixa(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Body() configurarRemuneracaoDto: ConfigurarRemuneracaoReqDto,
  ): Promise<boolean> {
    const result = await this.remuneracaoService.configurarTaxaFixa(
      Number(usuario.empresaId),
      configurarRemuneracaoDto,
    );
    return result;
  }
}
