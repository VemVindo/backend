import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Cargos } from '../auth/decorators/cargos.decorator';
import { UsuarioAtual } from '../auth/decorators/usuario-atual.decorator';
import type { UsuarioAutenticado } from '../auth/jwt.strategy';
import { Cargo } from '../common/enums/cargo.enum';
import { CpfParamDto } from './dto/cpf-param.dto';
import { CadastrarEntregadorDto } from './dto/cadastrar-entregador.dto';
import { VincularEntregadorDto } from './dto/vincular-entregador.dto';
import { EntregadorService } from './entregador.service';

// Cadastro e convite recebem CPF de terceiros; o limite dificulta varrer CPFs.
const LIMITE_OPERACOES_POR_CPF = { default: { limit: 10, ttl: 60_000 } };

@Controller('entregadores')
@Cargos(Cargo.ESTABELECIMENTO)
export class EntregadorController {
  constructor(private readonly entregadorService: EntregadorService) {}

  @Throttle(LIMITE_OPERACOES_POR_CPF)
  @Post()
  cadastrar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Body() dto: CadastrarEntregadorDto,
  ) {
    return this.entregadorService.cadastrar(Number(usuario.empresaId), dto);
  }

  @Throttle(LIMITE_OPERACOES_POR_CPF)
  @Post('vinculo')
  @HttpCode(HttpStatus.ACCEPTED)
  convidar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Body() dto: VincularEntregadorDto,
  ) {
    return this.entregadorService.convidar(Number(usuario.empresaId), dto.cpf);
  }

  @Get()
  listarFrota(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.entregadorService.listarFrota(Number(usuario.empresaId));
  }

  @Throttle(LIMITE_OPERACOES_POR_CPF)
  @Post(':cpf/senha-temporaria')
  @HttpCode(HttpStatus.OK)
  gerarNovaSenhaTemporaria(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param() { cpf }: CpfParamDto,
  ) {
    return this.entregadorService.gerarNovaSenhaTemporaria(
      Number(usuario.empresaId),
      cpf,
    );
  }

  @Delete(':cpf/vinculo')
  @HttpCode(HttpStatus.NO_CONTENT)
  desvincular(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param() { cpf }: CpfParamDto,
  ) {
    return this.entregadorService.desvincular(Number(usuario.empresaId), cpf);
  }
}
