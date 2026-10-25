import { Body, Controller, Get, Put } from '@nestjs/common';
import { Cargos } from '../auth/decorators/cargos.decorator';
import { UsuarioAtual } from '../auth/decorators/usuario-atual.decorator';
import type { UsuarioAutenticado } from '../auth/jwt.strategy';
import { Cargo } from '../common/enums/cargo.enum';
import { AtualizarCadastroDto } from './dto/atualizar-cadastro.dto';
import { EmpresaService } from './empresa.service';

@Controller('empresa/cadastro')
@Cargos(Cargo.ESTABELECIMENTO)
export class CadastroEmpresaController {
  constructor(private readonly empresaService: EmpresaService) {}

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
    });
  }
}
