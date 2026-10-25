import { StatusContrato, StatusPedido } from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DashboardRepository,
  FiltroDoDashboard,
} from '../dashboard.repository';

jest.mock('../../prisma/prisma.service', () => ({ PrismaService: class {} }));

const INICIO = new Date('2026-10-01T00:00:00Z');
const FIM = new Date('2026-10-31T23:59:59Z');
const SEM_PERIODO: FiltroDoDashboard = { idEmpresa: 7 };
const OUTUBRO: FiltroDoDashboard = {
  idEmpresa: 7,
  dataInicio: INICIO,
  dataFinal: FIM,
};

function montar() {
  const prisma = {
    pedido: {
      count: jest.fn().mockResolvedValue(4),
      findMany: jest.fn().mockResolvedValue([]),
      aggregate: jest.fn().mockResolvedValue({ _sum: { distancia: 1500 } }),
    },
    avaliacao: {
      aggregate: jest
        .fn()
        .mockResolvedValue({ _avg: { avaliacao_entrega: 4.5 } }),
    },
    entregador: { findMany: jest.fn().mockResolvedValue([]) },
  };
  return {
    repo: new DashboardRepository(prisma as unknown as PrismaService),
    prisma,
  };
}

describe('DashboardRepository', () => {
  describe('contarPedidos', () => {
    it('conta todos os pedidos da empresa quando nao ha periodo', async () => {
      const { repo, prisma } = montar();

      await expect(repo.contarPedidos(SEM_PERIODO)).resolves.toBe(4);
      expect(prisma.pedido.count).toHaveBeenCalledWith({
        where: { idEmpresa: 7, status: undefined },
      });
    });

    it('sem status, filtra o periodo pela data de criacao', async () => {
      const { repo, prisma } = montar();

      await repo.contarPedidos(OUTUBRO);

      expect(prisma.pedido.count).toHaveBeenCalledWith({
        where: {
          idEmpresa: 7,
          status: undefined,
          data_criacao: { gte: INICIO, lte: FIM },
        },
      });
    });

    it.each([
      [StatusPedido.PENDENTE, 'data_criacao'],
      [StatusPedido.EM_ANDAMENTO, 'data_inicio_entrega'],
      [StatusPedido.FINALIZADO, 'data_finalizacao'],
      [StatusPedido.CANCELADO, 'data_criacao'],
    ])('%s entra no periodo por %s', async (status, campoData) => {
      const { repo, prisma } = montar();

      await repo.contarPedidos(OUTUBRO, status);

      expect(prisma.pedido.count).toHaveBeenCalledWith({
        where: {
          idEmpresa: 7,
          status,
          [campoData]: { gte: INICIO, lte: FIM },
        },
      });
    });

    it('aceita periodo aberto em uma das pontas', async () => {
      const { repo, prisma } = montar();

      await repo.contarPedidos({ idEmpresa: 7, dataInicio: INICIO });
      await repo.contarPedidos({ idEmpresa: 7, dataFinal: FIM });

      expect(prisma.pedido.count).toHaveBeenNthCalledWith(1, {
        where: {
          idEmpresa: 7,
          status: undefined,
          data_criacao: { gte: INICIO, lte: undefined },
        },
      });
      expect(prisma.pedido.count).toHaveBeenNthCalledWith(2, {
        where: {
          idEmpresa: 7,
          status: undefined,
          data_criacao: { gte: undefined, lte: FIM },
        },
      });
    });
  });

  it('calcula a media das notas dos pedidos da empresa no periodo', async () => {
    const { repo, prisma } = montar();

    await expect(repo.mediaDasAvaliacoes(OUTUBRO)).resolves.toBe(4.5);
    expect(prisma.avaliacao.aggregate).toHaveBeenCalledWith({
      where: {
        pedido: { idEmpresa: 7 },
        data: { gte: INICIO, lte: FIM },
      },
      _avg: { avaliacao_entrega: true },
    });
  });

  it('lista inicio e fim das entregas concluidas', async () => {
    const { repo, prisma } = montar();

    await expect(repo.listarDuracoesDeEntrega(SEM_PERIODO)).resolves.toEqual(
      [],
    );
    expect(prisma.pedido.findMany).toHaveBeenCalledWith({
      where: {
        idEmpresa: 7,
        status: StatusPedido.FINALIZADO,
        data_inicio_entrega: { not: null },
        data_finalizacao: { not: null },
      },
      select: { data_inicio_entrega: true, data_finalizacao: true },
    });
  });

  it('soma a distancia das entregas concluidas no periodo', async () => {
    const { repo, prisma } = montar();

    await expect(repo.somarDistanciaPercorrida(OUTUBRO)).resolves.toBe(1500);
    expect(prisma.pedido.aggregate).toHaveBeenCalledWith({
      where: {
        idEmpresa: 7,
        status: StatusPedido.FINALIZADO,
        data_inicio_entrega: { not: null },
        data_finalizacao: { gte: INICIO, lte: FIM },
      },
      _sum: { distancia: true },
    });
  });

  it('soma zero quando nao ha entrega concluida', async () => {
    const { repo, prisma } = montar();
    prisma.pedido.aggregate.mockResolvedValue({ _sum: { distancia: null } });

    await expect(repo.somarDistanciaPercorrida(SEM_PERIODO)).resolves.toBe(0);
  });

  it('lista os entregadores com contrato ativo e so os campos do relatorio', async () => {
    const { repo, prisma } = montar();

    await repo.listarEntregadoresAtivos(OUTUBRO);

    expect(prisma.entregador.findMany).toHaveBeenCalledWith({
      where: {
        contratos: {
          some: { status: StatusContrato.ATIVO, idEmpresa: 7 },
        },
      },
      select: {
        cpf: true,
        nome: true,
        pedidos: {
          where: {
            idEmpresa: 7,
            OR: [
              {
                status: StatusPedido.EM_ANDAMENTO,
                data_inicio_entrega: { gte: INICIO, lte: FIM },
              },
              {
                status: StatusPedido.FINALIZADO,
                data_finalizacao: { gte: INICIO, lte: FIM },
              },
            ],
          },
          select: { status: true, valor_entrega: true },
        },
      },
    });
  });
});
