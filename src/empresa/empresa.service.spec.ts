import { NotFoundException } from '@nestjs/common';
import { EmpresaRepository } from './empresa.repository';
import { EmpresaService } from './empresa.service';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

function montar(exibeMapa: boolean | null = true) {
  const repositorio = {
    exibeMapa: jest.fn().mockResolvedValue(exibeMapa),
    definirExibirMapa: jest.fn().mockResolvedValue(undefined),
  };
  const service = new EmpresaService(
    repositorio as unknown as EmpresaRepository,
  );
  return { service, repositorio };
}

describe('EmpresaService configuracoes', () => {
  it('consulta se o recebedor ve o mapa', async () => {
    const { service } = montar(false);
    await expect(service.consultarConfiguracoes(1)).resolves.toEqual({
      exibirMapa: false,
    });
  });

  it('responde 404 para empresa inexistente', async () => {
    const { service } = montar(null);
    await expect(service.consultarConfiguracoes(1)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('grava a escolha da empresa', async () => {
    const { service, repositorio } = montar();

    const resposta = await service.atualizarConfiguracoes(7, {
      exibirMapa: false,
    });

    expect(repositorio.definirExibirMapa).toHaveBeenCalledWith(7, false);
    expect(resposta).toEqual({ exibirMapa: false });
  });
});
