import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
} from '@nestjs/common';
import { Cargos } from '../auth/decorators/cargos.decorator';
import { UsuarioAtual } from '../auth/decorators/usuario-atual.decorator';
import type { UsuarioAutenticado } from '../auth/jwt.strategy';
import { Cargo } from '../common/enums/cargo.enum';
import { LocalizarEnderecoDto } from '../mapa/dto/localizar-endereco.dto';
import { RotaDeCarroService } from '../mapa/rota-de-carro.service';
import { AtualizarCadastroDto } from './dto/atualizar-cadastro.dto';
import { EmpresaService } from './empresa.service';
import { pinoDaEmpresa } from './pino-da-empresa';

@Controller('empresa/cadastro')
@Cargos(Cargo.ESTABELECIMENTO)
export class CadastroEmpresaController {
  constructor(
    private readonly empresaService: EmpresaService,
    private readonly rotaDeCarro: RotaDeCarroService,
  ) {}

  @Get()
  consultar(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.empresaService.consultarCadastro(Number(usuario.empresaId));
  }

  @Put()
  atualizar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Body() dto: AtualizarCadastroDto,
  ) {
    return this.empresaService.atualizarCadastro(Number(usuario.empresaId), {
      nomeFantasia: dto.nomeFantasia,
      email: dto.email,
      telefone: dto.telefone,
      cep: dto.cep,
      logradouro: dto.logradouro,
      numero: dto.numero,
      complemento: dto.complemento ?? null,
      bairro: dto.bairro,
      cidade: dto.cidade,
      uf: dto.uf,
      origem: pinoDaEmpresa(dto.origemLat, dto.origemLng),
    });
  }

  /** Sugere o pino inicial a partir do endereco do formulario, antes de salvar. */
  @Post('localizar')
  @HttpCode(HttpStatus.OK)
  async localizar(@Body() endereco: LocalizarEnderecoDto) {
    const localizado = await this.rotaDeCarro.localizarOrigem(endereco);
    return {
      coordenada: localizado?.coordenada ?? null,
      precisao: localizado?.precisao ?? null,
      enderecoEncontrado: localizado?.enderecoEncontrado ?? null,
    };
  }
}
