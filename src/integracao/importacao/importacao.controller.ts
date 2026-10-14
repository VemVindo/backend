import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { Cargos } from '../../auth/decorators/cargos.decorator';
import { UsuarioAtual } from '../../auth/decorators/usuario-atual.decorator';
import type { UsuarioAutenticado } from '../../auth/jwt.strategy';
import { Cargo } from '../../common/enums/cargo.enum';
import { AutenticarIntegracao } from '../decorators/autenticar-integracao.decorator';
import { EmpresaDaIntegracao } from '../decorators/empresa-da-integracao.decorator';
import { ImportarPedidosDto } from './dto/importar-pedidos.dto';
import { ImportacaoService } from './importacao.service';

@Controller('integracao')
export class ImportacaoController {
  constructor(private readonly importacaoService: ImportacaoService) {}

  @AutenticarIntegracao()
  @Post('pedidos')
  @HttpCode(HttpStatus.OK)
  importar(
    @EmpresaDaIntegracao() empresaId: number,
    @Body() dto: ImportarPedidosDto,
  ) {
    return this.importacaoService.importar(empresaId, dto.pedidos);
  }

  @Cargos(Cargo.ESTABELECIMENTO)
  @Get('pendencias')
  listarPendencias(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.importacaoService.listarPendencias(Number(usuario.empresaId));
  }

  @Cargos(Cargo.ESTABELECIMENTO)
  @Post('pendencias/:id/completar')
  @HttpCode(HttpStatus.OK)
  completar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('id', ParseIntPipe) idPendencia: number,
    @Body() complemento: Record<string, unknown>,
  ) {
    return this.importacaoService.completar(
      Number(usuario.empresaId),
      idPendencia,
      complemento,
    );
  }
}
