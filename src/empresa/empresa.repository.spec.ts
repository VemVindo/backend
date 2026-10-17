import { PrismaService } from '../prisma/prisma.service';
import { EmpresaRepository } from './empresa.repository';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

function montar(encontrada: { exibir_mapa: boolean } | null) {
  const prisma = {
    empresa: {
      findUnique: jest.fn().mockResolvedValue(encontrada),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  return {
    repositorio: new EmpresaRepository(prisma as unknown as PrismaService),
    prisma,
  };
}

describe('EmpresaRepository configuracao do mapa', () => {
  it('le so o campo exibir_mapa', async () => {
    const { repositorio, prisma } = montar({ exibir_mapa: false });

    await expect(repositorio.exibeMapa(3)).resolves.toBe(false);
    expect(prisma.empresa.findUnique).toHaveBeenCalledWith({
      where: { id_empresa: 3 },
      select: { exibir_mapa: true },
    });
  });

  it('devolve null para empresa inexistente', async () => {
    const { repositorio } = montar(null);
    await expect(repositorio.exibeMapa(3)).resolves.toBeNull();
  });

  it('grava a escolha da empresa', async () => {
    const { repositorio, prisma } = montar({ exibir_mapa: true });

    await repositorio.definirExibirMapa(3, false);

    expect(prisma.empresa.update).toHaveBeenCalledWith({
      where: { id_empresa: 3 },
      data: { exibir_mapa: false },
    });
  });
});
