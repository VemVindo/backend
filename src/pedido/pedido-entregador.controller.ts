import { Controller, Get } from '@nestjs/common';
import { Cargos } from '../auth/decorators/cargos.decorator';
import { UsuarioAtual } from '../auth/decorators/usuario-atual.decorator';
import type { UsuarioAutenticado } from '../auth/jwt.strategy';
import { Cargo } from '../common/enums/cargo.enum';
import { PedidoEntregadorService } from './pedido-entregador.service';

@Controller('entregador/pedidos')
@Cargos(Cargo.ENTREGADOR)
export class PedidoEntregadorController {
  constructor(private readonly pedidoService: PedidoEntregadorService) {}

  @Get()
  listar(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.pedidoService.listar(usuario.usuarioId);
  }
}
