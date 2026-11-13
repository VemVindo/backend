import type { UsuarioAutenticado } from '../../auth/jwt.strategy';
import { Cargo } from '../../common/enums/cargo.enum';
import { PerfilEntregadorController } from '../perfil-entregador.controller';
import { PerfilEntregadorService } from '../perfil-entregador.service';

jest.mock('../../prisma/prisma.service', () => ({ PrismaService: class {} }));

const ENTREGADOR: UsuarioAutenticado = {
  usuarioId: '52998224725',
  cargo: Cargo.ENTREGADOR,
};

describe('PerfilEntregadorController', () => {
  function montar() {
    const perfil = {
      consultar: jest.fn().mockResolvedValue('perfil'),
      editar: jest.fn().mockResolvedValue('editado'),
    };
    const controlador = new PerfilEntregadorController(
      perfil as unknown as PerfilEntregadorService,
    );
    return { controlador, perfil };
  }

  it('consulta o cadastro do entregador do token', async () => {
    const { controlador, perfil } = montar();

    await expect(controlador.consultar(ENTREGADOR)).resolves.toBe('perfil');
    expect(perfil.consultar).toHaveBeenCalledWith('52998224725');
  });

  it('edita o cadastro do entregador do token, nunca o de outro CPF', async () => {
    const { controlador, perfil } = montar();
    const dados = { telefone: '61988887777' };

    await expect(controlador.editar(ENTREGADOR, dados)).resolves.toBe(
      'editado',
    );
    expect(perfil.editar).toHaveBeenCalledWith('52998224725', dados);
  });
});
