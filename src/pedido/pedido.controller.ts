import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Cargos } from '../auth/decorators/cargos.decorator';
import { UsuarioAtual } from '../auth/decorators/usuario-atual.decorator';
import type { UsuarioAutenticado } from '../auth/jwt.strategy';
import { Cargo } from '../common/enums/cargo.enum';
import { AtualizarStatusPedidoDto } from './dto/atualizar-status-pedido.dto';
import { CriaPedidoReqDto, CriaPedidoResDto } from './dto/cria-pedido.dto';
import { FinalizarPedidoDto } from './dto/finalizar-pedido.dto';
import { CorrigirDistanciaDto } from './dto/corrigir-distancia.dto';
import { ReatribuirPedidoDto } from './dto/reatribuir-pedido.dto';
import { ConversaDoPedidoService } from './conversa-do-pedido.service';
import { PedidoService } from './pedido.service';

@Controller('pedidos')
export class PedidoController {
  constructor(
    private readonly pedidoService: PedidoService,
    private readonly conversas: ConversaDoPedidoService,
  ) {}

  @Post()
  @Cargos(Cargo.ESTABELECIMENTO)
  async criar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Body() pedidoDto: CriaPedidoReqDto,
  ): Promise<CriaPedidoResDto> {
    const pedido = await this.pedidoService.criar(
      Number(usuario.empresaId),
      pedidoDto,
    );
    return plainToInstance(CriaPedidoResDto, pedido);
  }

  @Get()
  @Cargos(Cargo.ESTABELECIMENTO)
  listarDaEmpresa(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.pedidoService.listarDaEmpresa(Number(usuario.empresaId));
  }

  @Get('minhas-entregas')
  @Cargos(Cargo.ENTREGADOR)
  listarDoEntregador(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.pedidoService.listarDoEntregador(usuario.usuarioId);
  }

  @Get(':id/status-disponiveis')
  @Cargos(Cargo.ENTREGADOR)
  obterStatusDisponiveis(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) idPedido: number,
  ) {
    return this.pedidoService.obterStatusDisponiveis(
      usuario.usuarioId,
      idPedido,
    );
  }

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

  @Post(':id/finalizar')
  @Cargos(Cargo.ENTREGADOR)
  @HttpCode(HttpStatus.OK)
  finalizar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) idPedido: number,
    @Body() dto: FinalizarPedidoDto,
  ) {
    return this.pedidoService.finalizar(
      usuario.usuarioId,
      idPedido,
      dto.codigo,
    );
  }

  @Patch(':id/atribuir')
  @Cargos(Cargo.ESTABELECIMENTO)
  atribuir(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) idPedido: number,
    @Body() dto: ReatribuirPedidoDto,
  ) {
    return this.pedidoService.atribuir(
      Number(usuario.empresaId),
      idPedido,
      dto.cpfEntregador,
    );
  }

  @Patch(':id/distancia')
  @Cargos(Cargo.ESTABELECIMENTO)
  corrigirDistancia(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) idPedido: number,
    @Body() correcaoDistancia: CorrigirDistanciaDto,
  ) {
    return this.pedidoService.corrigirDistancia(
      Number(usuario.empresaId),
      idPedido,
      correcaoDistancia.distanciaMetros,
    );
  }

  @Patch(':id/entregador')
  @Cargos(Cargo.ESTABELECIMENTO)
  reatribuir(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) idPedido: number,
    @Body() dto: ReatribuirPedidoDto,
  ) {
    return this.pedidoService.reatribuir(
      Number(usuario.empresaId),
      idPedido,
      dto.cpfEntregador,
    );
  }

  @Get(':id/historico-entregadores')
  @Cargos(Cargo.ESTABELECIMENTO)
  listarHistoricoDeEntregadores(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) idPedido: number,
  ) {
    return this.pedidoService.listarHistoricoDeEntregadores(
      Number(usuario.empresaId),
      idPedido,
    );
  }

  @Get(':id/whatsapp/entregador')
  @Cargos(Cargo.ESTABELECIMENTO)
  conversaComEntregador(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) idPedido: number,
  ) {
    return this.conversas.conversaComEntregador(
      Number(usuario.empresaId),
      idPedido,
    );
  }

  @Get(':id/whatsapp/estabelecimento')
  @Cargos(Cargo.ENTREGADOR)
  conversaComEstabelecimento(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) idPedido: number,
  ) {
    return this.conversas.conversaComEstabelecimento(
      usuario.usuarioId,
      idPedido,
    );
  }

  @Get(':id/whatsapp/recebedor')
  @Cargos(Cargo.ESTABELECIMENTO)
  conversaComRecebedor(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) idPedido: number,
  ) {
    return this.conversas.conversaComRecebedor(
      Number(usuario.empresaId),
      idPedido,
    );
  }

  @Get(':id')
  @Cargos(Cargo.ESTABELECIMENTO)
  detalhar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) idPedido: number,
  ) {
    return this.pedidoService.detalhar(Number(usuario.empresaId), idPedido);
  }
}
