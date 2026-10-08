import { Controller, Get, UnauthorizedException } from '@nestjs/common';
import { Cargos } from '../auth/decorators/cargos.decorator';
import { UsuarioAtual } from '../auth/decorators/usuario-atual.decorator';
import type { UsuarioAutenticado } from '../auth/jwt.strategy';
import { Cargo } from '../common/enums/cargo.enum';
import { PedidoService } from './pedido.service';

@Controller('pedidos')
export class PedidoController {
  constructor(private readonly pedidoService: PedidoService) {}

  @Get('ativos')
  @Cargos(Cargo.ESTABELECIMENTO)
  listarAtivos(@UsuarioAtual() usuario: UsuarioAutenticado) {
    const id_empresa = Number(usuario.empresaId);
    if (!Number.isSafeInteger(id_empresa) || id_empresa <= 0) {
      throw new UnauthorizedException();
    }
    return this.pedidoService.listarAtivos(id_empresa);
  }
}
