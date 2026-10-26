import { NotFoundException } from '@nestjs/common';
import { EmpresaRepository } from './empresa.repository';
import { EmpresaService } from './empresa.service';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

function montar(exibeMapa: boolean | null = true) {
  const repositorio = {
    exibeMapa: jest.fn().mockResolvedValue(exibeMapa),
    definirExibirMapa: jest.fn().mockResolvedValue(undefined),
  };
  const servico = new EmpresaService(
    repositorio as unknown as EmpresaRepository,
  );
  return { servico, repositorio };
}

describe('EmpresaService configuracoes', () => {
  it('consulta se o recebedor ve o mapa', async () => {
    const { servico } = montar(false);
    await expect(servico.consultarConfiguracoes(1)).resolves.toEqual({
      exibirMapa: false,
    });
  });

  it('responde 404 para empresa inexistente', async () => {
    const { servico } = montar(null);
    await expect(servico.consultarConfiguracoes(1)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('grava a escolha da empresa', async () => {
    const { servico, repositorio } = montar();

    const resposta = await servico.atualizarConfiguracoes(7, {
      exibirMapa: false,
    });

    expect(repositorio.definirExibirMapa).toHaveBeenCalledWith(7, false);
    expect(resposta).toEqual({ exibirMapa: false });
  });
});
