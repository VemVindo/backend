import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { Cargos } from '../auth/decorators/cargos.decorator';
import { UsuarioAtual } from '../auth/decorators/usuario-atual.decorator';
import type { UsuarioAutenticado } from '../auth/jwt.strategy';
import { Cargo } from '../common/enums/cargo.enum';
import { CredencialService } from './credencial.service';
import { AutenticarIntegracao } from './decorators/autenticar-integracao.decorator';
import { EmpresaDaIntegracao } from './decorators/empresa-da-integracao.decorator';

@Controller('integracao')
export class CredencialController {
  constructor(private readonly credencialService: CredencialService) {}

  @Cargos(Cargo.ESTABELECIMENTO)
  @Get('credencial')
  consultar(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.credencialService.consultar(Number(usuario.empresaId));
  }

  @Cargos(Cargo.ESTABELECIMENTO)
  @Post('credencial')
  gerar(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.credencialService.gerar(Number(usuario.empresaId));
  }

  @Cargos(Cargo.ESTABELECIMENTO)
  @Post('credencial/rotacionar')
  @HttpCode(HttpStatus.OK)
  rotacionar(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.credencialService.rotacionar(Number(usuario.empresaId));
  }

  @Cargos(Cargo.ESTABELECIMENTO)
  @Delete('credencial')
  @HttpCode(HttpStatus.NO_CONTENT)
  revogar(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.credencialService.revogar(Number(usuario.empresaId));
  }

  // Para o estabelecimento testar a chave no sistema dele antes de integrar.
  @AutenticarIntegracao()
  @Get('verificar')
  verificar(@EmpresaDaIntegracao() empresaId: number) {
    return { valida: true, empresaId };
  }
}
