import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Patch,
} from '@nestjs/common';
import { Cargos } from '../auth/decorators/cargos.decorator';
import { UsuarioAtual } from '../auth/decorators/usuario-atual.decorator';
import type { UsuarioAutenticado } from '../auth/jwt.strategy';
import { Cargo } from '../common/enums/cargo.enum';
import { AtualizarStatusPedidoDto } from './dto/atualizar-status-pedido.dto';
import { PedidoService } from './pedido.service';

@Controller('pedidos')
export class PedidoController {
  constructor(
    private readonly pedidoService: PedidoService,
  ) { }

  @Patch(':id/status')
  @Cargos(Cargo.ENTREGADOR)
  atualizarStatus(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) idPedido: number,
    @Body() dto: AtualizarStatusPedidoDto,
  ) {
    return this.pedidoService.atualizarStatus(
      usuario.usuarioId,
      idPedido,
      dto.status,
    );
  }
}