import type { UsuarioAutenticado } from '../auth/jwt.strategy';
import { Cargo } from '../common/enums/cargo.enum';
import { EmpresaController } from './empresa.controller';
import { EmpresaService } from './empresa.service';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

const EMPRESA: UsuarioAutenticado = {
  usuarioId: '3',
  cargo: Cargo.ESTABELECIMENTO,
  empresaId: '3',
};

describe('EmpresaController', () => {
  const service = {
    consultarConfiguracoes: jest.fn().mockResolvedValue({ exibirMapa: true }),
    atualizarConfiguracoes: jest.fn().mockResolvedValue({ exibirMapa: false }),
  };
  const controller = new EmpresaController(
    service as unknown as EmpresaService,
  );

  it('usa a empresa do token, nunca um id vindo do corpo', async () => {
    await controller.consultar(EMPRESA);
    await controller.atualizar(EMPRESA, { exibirMapa: false });

    expect(service.consultarConfiguracoes).toHaveBeenCalledWith(3);
    expect(service.atualizarConfiguracoes).toHaveBeenCalledWith(3, {
      exibirMapa: false,
    });
  });
});
