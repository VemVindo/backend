import { PrismaService } from '../prisma/prisma.service';
import { AvaliacaoRepository, LIMITE_DA_LISTA } from './avaliacao.repository';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

function montar() {
  const prisma = {
    avaliacao: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
  return {
    repo: new AvaliacaoRepository(prisma as unknown as PrismaService),
    prisma,
  };
}

const INCLUDE = {
  pedido: {
    select: { id_pedido: true, entregador: { select: { nome: true } } },
  },
};

describe('AvaliacaoRepository', () => {
  it('cria a nota sem comentario', async () => {
    const { repo, prisma } = montar();
    const data = new Date('2026-10-20T13:00:00Z');

    await repo.criar(42, 5, data);

    expect(prisma.avaliacao.create).toHaveBeenCalledWith({
      data: { idpedidos: 42, avaliacao_entrega: 5, data },
    });
  });

  it('so grava o comentario se ainda nao houver um', async () => {
    const { repo, prisma } = montar();

    await expect(repo.registrarComentario(42, 'Oi')).resolves.toBe(true);
    expect(prisma.avaliacao.updateMany).toHaveBeenCalledWith({
      where: { idpedidos: 42, comentario: null },
      data: { comentario: 'Oi' },
    });

    prisma.avaliacao.updateMany.mockResolvedValue({ count: 0 });
    await expect(repo.registrarComentario(42, 'De novo')).resolves.toBe(false);
  });

  it('lista so a empresa, da mais recente para a mais antiga', async () => {
    const { repo, prisma } = montar();

    await repo.listarDaEmpresa(3, {});

    expect(prisma.avaliacao.findMany).toHaveBeenCalledWith({
      where: { pedido: { idEmpresa: 3 } },
      include: INCLUDE,
      orderBy: { data: 'desc' },
      take: LIMITE_DA_LISTA,
    });
  });

  it('aplica os filtros de nota e periodo', async () => {
    const { repo, prisma } = montar();
    const de = new Date('2026-10-01T00:00:00Z');
    const ate = new Date('2026-10-20T23:59:59Z');

    await repo.listarDaEmpresa(3, { notas: [1, 2], de, ate });

    expect(prisma.avaliacao.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          pedido: { idEmpresa: 3 },
          avaliacao_entrega: { in: [1, 2] },
          data: { gte: de, lte: ate },
        },
      }),
    );
  });
});
