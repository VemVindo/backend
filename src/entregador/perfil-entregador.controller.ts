import { Body, Controller, Get, Patch } from '@nestjs/common';
import { Cargos } from '../auth/decorators/cargos.decorator';
import { UsuarioAtual } from '../auth/decorators/usuario-atual.decorator';
import type { UsuarioAutenticado } from '../auth/jwt.strategy';
import { Cargo } from '../common/enums/cargo.enum';
import { EditarPerfilDto } from './dto/editar-perfil.dto';
import { PerfilEntregadorService } from './perfil-entregador.service';

// Sem @PermitirSenhaTemporaria: com a senha temporaria a resposta e 403.
@Controller('entregador/perfil')
@Cargos(Cargo.ENTREGADOR)
export class PerfilEntregadorController {
  constructor(private readonly perfil: PerfilEntregadorService) {}

  @Get()
  consultar(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.perfil.consultar(usuario.usuarioId);
  }

  @Patch()
  editar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Body() dados: EditarPerfilDto,
  ) {
    return this.perfil.editar(usuario.usuarioId, dados);
  }
}
