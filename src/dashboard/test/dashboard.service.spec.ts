import { StatusPedido } from '../../generated/prisma/enums';
import {
  DashboardRepository,
  EntregadorComPedidos,
} from '../dashboard.repository';
import { DashboardService } from '../dashboard.service';

jest.mock('../../prisma/prisma.service', () => ({ PrismaService: class {} }));

const INICIO = new Date('2026-10-01T00:00:00Z');

const TOTAL_POR_STATUS: Record<string, number> = {
  [StatusPedido.PENDENTE]: 2,
  [StatusPedido.EM_ANDAMENTO]: 3,
  [StatusPedido.FINALIZADO]: 4,
  [StatusPedido.CANCELADO]: 1,
};

const ENTREGADOR: EntregadorComPedidos = {
  cpf: '52998224725',
  nome: 'Entregador Teste',
  pedidos: [
    { status: StatusPedido.FINALIZADO, valor_entrega: 1000 },
    { status: StatusPedido.FINALIZADO, valor_entrega: 1501 },
    { status: StatusPedido.EM_ANDAMENTO, valor_entrega: 900 },
  ],
};

function montar() {
  const repositorio = {
    contarPedidos: jest.fn((_filtro: unknown, status?: StatusPedido) =>
      Promise.resolve(status ? TOTAL_POR_STATUS[status] : 10),
    ),
    mediaDasAvaliacoes: jest.fn().mockResolvedValue(4.5),
    listarDuracoesDeEntrega: jest.fn().mockResolvedValue([
      {
        data_inicio_entrega: new Date('2026-10-10T12:00:00Z'),
        data_finalizacao: new Date('2026-10-10T12:20:00Z'),
      },
      {
        data_inicio_entrega: new Date('2026-10-11T12:00:00Z'),
        data_finalizacao: new Date('2026-10-11T12:40:00Z'),
      },
    ]),
    somarDistanciaPercorrida: jest.fn().mockResolvedValue(1500),
    listarEntregadoresAtivos: jest.fn().mockResolvedValue([ENTREGADOR]),
  };
  return {
    servico: new DashboardService(
      repositorio as unknown as DashboardRepository,
    ),
    repositorio,
  };
}

describe('DashboardService', () => {
  it('monta o resumo da empresa no periodo pedido', async () => {
    const { servico, repositorio } = montar();

    await expect(
      servico.montarDashboard(7, { dataInicio: INICIO }),
    ).resolves.toEqual({
      idEmpresa: 7,
      totalPedidos: 10,
      totalPedidosPendentes: 2,
      totalPedidosAndamento: 3,
      totalPedidosConcluidos: 4,
      totalPedidosCancelados: 1,
      mediaAvaliacoes: 4.5,
      tempoMedioEntregaMinutos: 30,
      totalDistanciaPercorrida: 1500,
      relatorioPorEntregador: [
        {
          cpf: '52998224725',
          nome: 'Entregador Teste',
          totalPedidosAndamento: 1,
          totalPedidosConcluidos: 2,
          valorMedioEntrega: 1250.5,
        },
      ],
    });
    const filtro = { idEmpresa: 7, dataInicio: INICIO };
    expect(repositorio.contarPedidos).toHaveBeenCalledWith(filtro);
    expect(repositorio.contarPedidos).toHaveBeenCalledTimes(5);
    expect(repositorio.listarEntregadoresAtivos).toHaveBeenCalledWith(filtro);
  });

  it('zera as medias quando nao ha avaliacao nem entrega concluida', async () => {
    const { servico, repositorio } = montar();
    repositorio.mediaDasAvaliacoes.mockResolvedValue(null);
    repositorio.listarDuracoesDeEntrega.mockResolvedValue([]);
    repositorio.listarEntregadoresAtivos.mockResolvedValue([
      {
        ...ENTREGADOR,
        pedidos: [{ status: StatusPedido.EM_ANDAMENTO, valor_entrega: 900 }],
      },
    ]);

    const resumo = await servico.montarDashboard(7, {});

    expect(resumo.mediaAvaliacoes).toBe(0);
    expect(resumo.tempoMedioEntregaMinutos).toBe(0);
    expect(resumo.relatorioPorEntregador[0]).toMatchObject({
      totalPedidosAndamento: 1,
      totalPedidosConcluidos: 0,
      valorMedioEntrega: 0,
    });
  });

  it('devolve relatorio vazio para empresa sem entregador ativo', async () => {
    const { servico, repositorio } = montar();
    repositorio.listarEntregadoresAtivos.mockResolvedValue([]);

    const resumo = await servico.montarDashboard(7, {});

    expect(resumo.relatorioPorEntregador).toEqual([]);
  });
});
