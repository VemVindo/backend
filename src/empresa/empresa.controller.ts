import { Body, Controller, Get, Patch } from '@nestjs/common';
import { Cargos } from '../auth/decorators/cargos.decorator';
import { UsuarioAtual } from '../auth/decorators/usuario-atual.decorator';
import type { UsuarioAutenticado } from '../auth/jwt.strategy';
import { Cargo } from '../common/enums/cargo.enum';
import { AtualizarConfiguracoesDto } from './dto/atualizar-configuracoes.dto';
import { EmpresaService } from './empresa.service';

@Controller('empresa/configuracoes')
@Cargos(Cargo.ESTABELECIMENTO)
export class EmpresaController {
  constructor(private readonly empresaService: EmpresaService) {}

  @Get()
  consultar(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.empresaService.consultarConfiguracoes(
      Number(usuario.empresaId),
    );
  }

  @Patch()
  atualizar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Body() dto: AtualizarConfiguracoesDto,
  ) {
    return this.empresaService.atualizarConfiguracoes(
      Number(usuario.empresaId),
      dto,
    );
  }
}
