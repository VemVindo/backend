import { PrismaService } from '../prisma/prisma.service';
import { RemuneracaoRepository } from './remuneracao.repository';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

function montar() {
  const prisma = {
    metricasPagamento: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
    },
  };
  return {
    repositorio: new RemuneracaoRepository(prisma as unknown as PrismaService),
    prisma,
  };
}

describe('RemuneracaoRepository', () => {
  const agora = new Date('2026-10-20T12:00:00Z');

  it('busca a linha mais recente que ja comecou a valer, so da empresa', async () => {
    const { repositorio, prisma } = montar();

    await repositorio.procurarVigentes(3, agora);

    expect(prisma.metricasPagamento.findFirst).toHaveBeenCalledWith({
      where: { idEmpresa: 3, data: { lte: agora } },
      orderBy: { data: 'desc' },
    });
  });

  it('cria uma linha nova em vez de sobrescrever a anterior', async () => {
    const { repositorio, prisma } = montar();

    await repositorio.registrar(
      3,
      { taxaFixa: 950, coeficienteKm: 210 },
      agora,
    );

    expect(prisma.metricasPagamento.create).toHaveBeenCalledWith({
      data: { idEmpresa: 3, taxa_fixa: 950, coeficiente: 210, data: agora },
    });
  });
});
