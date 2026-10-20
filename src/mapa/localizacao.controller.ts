import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Put,
} from '@nestjs/common';
import { Cargos } from '../auth/decorators/cargos.decorator';
import { UsuarioAtual } from '../auth/decorators/usuario-atual.decorator';
import type { UsuarioAutenticado } from '../auth/jwt.strategy';
import { Cargo } from '../common/enums/cargo.enum';
import { AcessoDoRecebedor } from '../rastreio/decorators/acesso-do-recebedor.decorator';
import { AutenticarRecebedor } from '../rastreio/decorators/autenticar-recebedor.decorator';
import type { AcessoComPedido } from '../rastreio/rastreio.repository';
import { RegistrarPosicaoDto } from './dto/registrar-posicao.dto';
import { LocalizacaoService } from './localizacao.service';

@Controller()
export class LocalizacaoController {
  constructor(private readonly localizacao: LocalizacaoService) {}

  @Put('pedidos/:id/localizacao')
  @Cargos(Cargo.ENTREGADOR)
  registrarPosicao(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) idPedido: number,
    @Body() dto: RegistrarPosicaoDto,
  ) {
    return this.localizacao.registrarPosicao(usuario.usuarioId, idPedido, dto);
  }

  // O entregador ve a rota das proprias entregas; a empresa, a dos pedidos
  // dela (E-US13).
  @Get('pedidos/:id/rota')
  @Cargos(Cargo.ENTREGADOR, Cargo.ESTABELECIMENTO)
  consultarRota(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) idPedido: number,
  ) {
    if (usuario.cargo === Cargo.ESTABELECIMENTO) {
      return this.localizacao.consultarParaEmpresa(
        Number(usuario.empresaId),
        idPedido,
      );
    }
    return this.localizacao.consultarParaEntregador(
      usuario.usuarioId,
      idPedido,
    );
  }

  @AutenticarRecebedor()
  @Get('rastreio/:token/localizacao')
  consultarParaRecebedor(@AcessoDoRecebedor() acesso: AcessoComPedido) {
    return this.localizacao.consultarParaRecebedor(acesso.idPedido);
  }
}
