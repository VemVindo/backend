import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ServicoDesempenhoEntregador } from './desempenho-entregador.service';
import { FiltroDesempenhoDto } from './dto/filtro-desempenho.dto';
import { Throttle } from '@nestjs/throttler';
import { Cargos } from '../auth/decorators/cargos.decorator';
import { UsuarioAtual } from '../auth/decorators/usuario-atual.decorator';
import type { UsuarioAutenticado } from '../auth/jwt.strategy';
import { Cargo } from '../common/enums/cargo.enum';
import { CpfParamDto } from './dto/cpf-param.dto';
import { CadastrarEntregadorDto } from './dto/cadastrar-entregador.dto';
import { VincularEntregadorDto } from './dto/vincular-entregador.dto';
import { EntregadorService } from './entregador.service';
import { RemocaoDaFrotaService } from './remocao-da-frota.service';
import { EditarEntregadorReqDto } from './dto/editar-entregador.dto';

// Cadastro e convite recebem CPF de terceiros; o limite dificulta varrer CPFs.
const LIMITE_OPERACOES_POR_CPF = { default: { limit: 10, ttl: 60_000 } };

@Controller('entregadores')
@Cargos(Cargo.ESTABELECIMENTO)
export class EntregadorController {
  constructor(
    private readonly entregadorService: EntregadorService,
    private readonly servicoDesempenho: ServicoDesempenhoEntregador,
    private readonly remocaoDaFrota: RemocaoDaFrotaService,
  ) {}

  @Get(':cpf/desempenho')
  consultarDesempenho(
    @UsuarioAtual() usuarioAutenticado: UsuarioAutenticado,
    @Param() { cpf: cpfEntregador }: CpfParamDto,
    @Query() filtroPeriodo: FiltroDesempenhoDto,
  ) {
    return this.servicoDesempenho.consultarDesempenho(
      Number(usuarioAutenticado.empresaId),
      cpfEntregador,
      filtroPeriodo,
    );
  }

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

  // Responde quais pedidos em andamento foram para outro entregador e quais
  // voltaram para PENDENTE.
  @Delete(':cpf/vinculo')
  @HttpCode(HttpStatus.OK)
  desvincular(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param() { cpf }: CpfParamDto,
  ) {
    return this.remocaoDaFrota.desvincular(Number(usuario.empresaId), cpf);
  }

  @Patch()
  async editar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Body() editarEntregadorDto: EditarEntregadorReqDto,
  ): Promise<boolean> {
    const result = this.entregadorService.editar(
      Number(usuario.empresaId),
      editarEntregadorDto,
    );
    return result;
  }
}
