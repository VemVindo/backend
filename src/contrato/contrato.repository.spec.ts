import { StatusContrato } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { ContratoRepository } from './contrato.repository';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

const AGORA = new Date('2026-10-25T12:00:00Z');
const CPF = '52998224725';

function montar() {
  const prisma = {
    contrato: {
      create: jest.fn().mockResolvedValue({ id_contrato: 1 }),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  return {
    repo: new ContratoRepository(prisma as unknown as PrismaService),
    prisma,
  };
}

describe('ContratoRepository', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(AGORA));
  afterEach(() => jest.useRealTimers());

  it('cria o convite pendente com a data de hoje', async () => {
    const { repo, prisma } = montar();

    await expect(repo.criarConvite(7, CPF)).resolves.toEqual({
      id_contrato: 1,
    });
    expect(prisma.contrato.create).toHaveBeenCalledWith({
      data: {
        idEmpresa: 7,
        cpf_entregador: CPF,
        status: StatusContrato.PENDENTE,
        data_inicio: AGORA,
      },
    });
  });

  it('busca o contrato mais antigo do entregador', async () => {
    const { repo, prisma } = montar();

    await expect(repo.primeiroDoEntregador(CPF)).resolves.toBeNull();
    expect(prisma.contrato.findFirst).toHaveBeenCalledWith({
      where: { cpf_entregador: CPF },
      orderBy: { id_contrato: 'asc' },
    });
  });

  it('lista convites pendentes e vinculos ativos com o nome da empresa', async () => {
    const { repo, prisma } = montar();

    await repo.listarAbertosDoEntregador(CPF);

    expect(prisma.contrato.findMany).toHaveBeenCalledWith({
      where: {
        cpf_entregador: CPF,
        status: { in: [StatusContrato.PENDENTE, StatusContrato.ATIVO] },
      },
      include: { empresa: { select: { nome_fantasia: true } } },
      orderBy: { data_inicio: 'desc' },
    });
  });

  it.each([
    [
      'aceitar',
      StatusContrato.PENDENTE,
      { status: StatusContrato.ATIVO, data_aceite: AGORA },
    ],
    [
      'recusar',
      StatusContrato.PENDENTE,
      { status: StatusContrato.RECUSADO, data_fim: AGORA },
    ],
    [
      'encerrarPeloEntregador',
      StatusContrato.ATIVO,
      { status: StatusContrato.ENCERRADO, data_fim: AGORA },
    ],
  ] as const)(
    '%s so altera contrato do proprio entregador no status %s',
    async (acao, statusEsperado, alteracao) => {
      const { repo, prisma } = montar();

      await expect(repo[acao](15, CPF)).resolves.toBe(true);
      expect(prisma.contrato.updateMany).toHaveBeenCalledWith({
        where: { id_contrato: 15, cpf_entregador: CPF, status: statusEsperado },
        data: alteracao,
      });

      prisma.contrato.updateMany.mockResolvedValue({ count: 0 });
      await expect(repo[acao](15, CPF)).resolves.toBe(false);
    },
  );
});
