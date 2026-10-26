import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Cargos } from '../auth/decorators/cargos.decorator';
import { RotaPublica } from '../auth/decorators/rota-publica.decorator';
import { UsuarioAtual } from '../auth/decorators/usuario-atual.decorator';
import type { UsuarioAutenticado } from '../auth/jwt.strategy';
import { Cargo } from '../common/enums/cargo.enum';
import { AcessoDoRecebedor } from '../rastreio/decorators/acesso-do-recebedor.decorator';
import type { AcessoComPedido } from '../rastreio/rastreio.repository';
import { AcessoParaAvaliarGuard } from './acesso-para-avaliar.guard';
import { AvaliacaoService } from './avaliacao.service';
import { AvaliarDto, ComentarDto } from './dto/avaliar.dto';
import { FiltroAvaliacoesDto } from './dto/filtro-avaliacoes.dto';

const LIMITE_DE_ENVIOS = { default: { limit: 10, ttl: 60_000 } };

@Controller('rastreio/:token/avaliacao')
@RotaPublica()
@UseGuards(AcessoParaAvaliarGuard)
export class AvaliacaoDoRecebedorController {
  constructor(private readonly avaliacoes: AvaliacaoService) {}

  @Get()
  consultar(@AcessoDoRecebedor() acesso: AcessoComPedido) {
    return this.avaliacoes.consultar(acesso);
  }

  @Post()
  @Throttle(LIMITE_DE_ENVIOS)
  avaliar(
    @AcessoDoRecebedor() acesso: AcessoComPedido,
    @Body() dto: AvaliarDto,
  ) {
    return this.avaliacoes.avaliar(acesso, dto.nota);
  }

  @Patch()
  @Throttle(LIMITE_DE_ENVIOS)
  comentar(
    @AcessoDoRecebedor() acesso: AcessoComPedido,
    @Body() dto: ComentarDto,
  ) {
    return this.avaliacoes.comentar(acesso, dto.comentario);
  }
}

@Controller('avaliacoes')
@Cargos(Cargo.ESTABELECIMENTO)
export class AvaliacaoDaEmpresaController {
  constructor(private readonly avaliacoes: AvaliacaoService) {}

  @Get()
  listar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Query() filtro: FiltroAvaliacoesDto,
  ) {
    return this.avaliacoes.listarDaEmpresa(Number(usuario.empresaId), filtro);
  }
}
