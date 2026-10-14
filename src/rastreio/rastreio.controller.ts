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
import { UsuarioAtual } from '../auth/decorators/usuario-atual.decorator';
import type { UsuarioAutenticado } from '../auth/jwt.strategy';
import { Cargo } from '../common/enums/cargo.enum';
import { AcessoDoRecebedor } from './decorators/acesso-do-recebedor.decorator';
import { AutenticarRecebedor } from './decorators/autenticar-recebedor.decorator';
import type { AcessoComPedido } from './rastreio.repository';
import { RastreioService } from './rastreio.service';

@Controller()
export class RastreioController {
  constructor(private readonly rastreioService: RastreioService) {}

  @AutenticarRecebedor()
  @Get('rastreio/:token')
  consultar(@AcessoDoRecebedor() acesso: AcessoComPedido) {
    return this.rastreioService.montarPaginaDoRecebedor(acesso);
  }

  @Cargos(Cargo.ESTABELECIMENTO)
  @Post('pedidos/:id/link-rastreio')
  @HttpCode(HttpStatus.OK)
  gerarNovoLink(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) idPedido: number,
  ) {
    return this.rastreioService.gerarNovoLink(
      Number(usuario.empresaId),
      idPedido,
    );
  }
}
