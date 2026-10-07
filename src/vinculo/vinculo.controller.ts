import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { Cargos } from '../auth/decorators/cargos.decorator';
import { PermitirSenhaTemporaria } from '../auth/decorators/permitir-senha-temporaria.decorator';
import { UsuarioAtual } from '../auth/decorators/usuario-atual.decorator';
import type { UsuarioAutenticado } from '../auth/jwt.strategy';
import { Cargo } from '../common/enums/cargo.enum';
import { VinculoService } from './vinculo.service';

@Controller('entregador')
@Cargos(Cargo.ENTREGADOR)
export class VinculoController {
  constructor(private readonly vinculoService: VinculoService) {}

  // O primeiro acesso mostra estes dados junto da troca de senha.
  @PermitirSenhaTemporaria()
  @Get('dados-compartilhados')
  dadosCompartilhados(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.vinculoService.dadosCompartilhados(usuario.usuarioId);
  }

  @PermitirSenhaTemporaria()
  @Get('vinculos')
  listar(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.vinculoService.listar(usuario.usuarioId);
  }

  @Post('vinculos/:id/aceitar')
  @HttpCode(HttpStatus.NO_CONTENT)
  aceitar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.vinculoService.aceitar(id, usuario.usuarioId);
  }

  @Post('vinculos/:id/recusar')
  @HttpCode(HttpStatus.NO_CONTENT)
  recusar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.vinculoService.recusar(id, usuario.usuarioId);
  }

  @Post('vinculos/:id/encerrar')
  @HttpCode(HttpStatus.NO_CONTENT)
  encerrar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.vinculoService.encerrar(id, usuario.usuarioId);
  }
}
