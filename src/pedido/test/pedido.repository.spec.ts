import { Test, TestingModule } from '@nestjs/testing';
import { PedidoRepository } from '../pedido.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { Pedido } from '../../generated/prisma/client';
import { CriaPedidoReqDto } from '../dto/cria-pedido.dto';
import { StatusPedido } from '../../generated/prisma/enums';
import { GanhoEntregaService } from '../../remuneracao/ganho-entrega.service';
import { RemuneracaoRepository } from '../../remuneracao/remuneracao.repository';
import { CalculoValorEntregaService } from '../../remuneracao/calculo-valor-entrega.service';
import {
  EntregadorIndisponivelError,
  PedidoAlteradoError,
} from '../pedido.erros';

describe('PedidoRepository', () => {
  let service: PedidoRepository;
  let prisma: PrismaService;

  describe('CRIAR', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PedidoRepository,
          { provide: GanhoEntregaService, useValue: {} },
          {
            provide: PrismaService,
            useValue: {
              pedido: {
                create: jest.fn(),
              },
            },
          },
        ],
      }).compile();
      service = module.get<PedidoRepository>(PedidoRepository);
      prisma = module.get<PrismaService>(PrismaService);
    });
    it('CAIXA CINZA: Fluxo Completo', () => {
      const dummyReq = {} as CriaPedidoReqDto;
      const dummyRes = {} as Pedido;
      jest.spyOn(prisma.pedido, 'create').mockResolvedValue(dummyRes);
      const result = service.criar(dummyReq, 1);
      expect(result).toBeInstanceOf(Promise<Pedido>);
    });
  });
});

const CPF_ANTERIOR = '52998224725';
const CPF_NOVO = '11144477735';
const ID_PEDIDO = 1;
const ID_EMPRESA = 7;

function montar() {
  const parametros_congelados = {
    taxa_fixa_atribuicao_centavos: 800,
    coeficiente_atribuicao_centavos_km: 150,
    parametros_vigentes_desde: new Date('2026-10-01T00:00:00Z'),
    remuneracao_atribuida_em: new Date('2026-10-02T00:00:00Z'),
  };
  const atual = {
    id_pedido: ID_PEDIDO,
    idEmpresa: ID_EMPRESA,
    status: StatusPedido.EM_ANDAMENTO,
    cpf_entregador: CPF_ANTERIOR,
    ganho_consolidado_centavos: null,
    distancia: 4200,
    distancia_conhecida: true,
    ...parametros_congelados,
  };
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ id_pedido: ID_PEDIDO }]),
    metricasPagamento: {
      findFirst: jest.fn().mockResolvedValue({
        taxa_fixa: 800,
        coeficiente: 150,
        data: parametros_congelados.parametros_vigentes_desde,
      }),
    },
    pedido: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({ id_pedido: ID_PEDIDO }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        ...atual,
        entregador: { nome: 'Ana Souza' },
      }),
    },
    entregador: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({}),
    },
    historicoPedidoEntregadores: {
      create: jest.fn().mockResolvedValue({}),
    },
  };
  const prisma = {
    pedido: {
      create: jest.fn().mockResolvedValue({ id_pedido: ID_PEDIDO }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    historicoPedidoEntregadores: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn((callback: (cliente: typeof tx) => unknown) =>
      callback(tx),
    ),
  };
  const ganhos = new GanhoEntregaService(
    new RemuneracaoRepository(prisma as unknown as PrismaService),
    new CalculoValorEntregaService(),
  );
  const repository = new PedidoRepository(
    prisma as unknown as PrismaService,
    ganhos,
  );
  return { repository, prisma, tx };
}

function argumento<T = Record<string, Record<string, unknown>>>(
  mock: jest.Mock,
): T {
  const [[primeiro]] = mock.mock.calls as [[T]];
  return primeiro;
}

describe('PedidoRepository.criar', () => {
  const pedido = { status: StatusPedido.PENDENTE } as CriaPedidoReqDto;

  it('grava a empresa recebida do token, sem transacao quando nao ha entregador', async () => {
    const { repository, prisma } = montar();

    await repository.criar(pedido, ID_EMPRESA);

    expect(argumento(prisma.pedido.create).data.idEmpresa).toBe(ID_EMPRESA);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('ocupa o entregador e marca o inicio da entrega ao criar com entregador', async () => {
    const { repository, tx } = montar();

    await repository.criar(
      {
        ...pedido,
        status: StatusPedido.EM_ANDAMENTO,
        cpf_entregador: CPF_NOVO,
      },
      ID_EMPRESA,
    );

    expect(tx.entregador.updateMany).toHaveBeenCalledWith({
      where: { cpf: CPF_NOVO, disponivel: true },
      data: { disponivel: false },
    });
    expect(argumento(tx.pedido.create).data.data_inicio_entrega).toBeInstanceOf(
      Date,
    );
  });

  it('abre o historico com o entregador da criacao', async () => {
    const { repository, tx } = montar();

    await repository.criar({ ...pedido, cpf_entregador: CPF_NOVO }, ID_EMPRESA);

    const { data } = argumento(tx.historicoPedidoEntregadores.create);
    expect(data).toMatchObject({
      id_pedido: ID_PEDIDO,
      cpf_entregador_antigo: null,
      cpf_entregador_novo: CPF_NOVO,
    });
    expect(data.data).toEqual(
      argumento(tx.pedido.create).data.data_inicio_entrega,
    );
  });

  it('nao cria o pedido se o entregador foi ocupado por outra operacao', async () => {
    const { repository, tx } = montar();
    tx.entregador.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      repository.criar({ ...pedido, cpf_entregador: CPF_NOVO }, ID_EMPRESA),
    ).rejects.toBeInstanceOf(EntregadorIndisponivelError);
    expect(tx.pedido.create).not.toHaveBeenCalled();
  });
});

describe('PedidoRepository.reatribuir', () => {
  const reatribuicao = {
    idPedido: ID_PEDIDO,
    statusAtual: StatusPedido.EM_ANDAMENTO,
    cpfAnterior: CPF_ANTERIOR,
    cpfNovo: CPF_NOVO,
  };

  it('so altera o pedido se status e entregador seguem os mesmos', async () => {
    const { repository, tx } = montar();

    await repository.reatribuir(reatribuicao);

    expect(tx.pedido.updateMany).toHaveBeenCalledWith({
      where: {
        id_pedido: ID_PEDIDO,
        status: StatusPedido.EM_ANDAMENTO,
        cpf_entregador: CPF_ANTERIOR,
        ganho_consolidado_centavos: null,
      },
      data: expect.objectContaining({
        cpf_entregador: CPF_NOVO,
        status: StatusPedido.EM_ANDAMENTO,
      }) as unknown,
    });
  });

  it('lanca PedidoAlteradoError e nao grava historico se o pedido mudou', async () => {
    const { repository, tx } = montar();
    tx.pedido.updateMany.mockResolvedValue({ count: 0 });

    await expect(repository.reatribuir(reatribuicao)).rejects.toBeInstanceOf(
      PedidoAlteradoError,
    );
    expect(tx.historicoPedidoEntregadores.create).not.toHaveBeenCalled();
  });

  it('ocupa o novo entregador apenas se ele ainda estiver disponivel', async () => {
    const { repository, tx } = montar();

    await repository.reatribuir(reatribuicao);

    expect(tx.entregador.updateMany).toHaveBeenCalledWith({
      where: { cpf: CPF_NOVO, disponivel: true },
      data: { disponivel: false },
    });
  });

  it('lanca EntregadorIndisponivelError se outro pedido ocupou o entregador', async () => {
    const { repository, tx } = montar();
    tx.entregador.updateMany.mockResolvedValue({ count: 0 });

    await expect(repository.reatribuir(reatribuicao)).rejects.toBeInstanceOf(
      EntregadorIndisponivelError,
    );
    expect(tx.historicoPedidoEntregadores.create).not.toHaveBeenCalled();
  });

  it('registra entregador anterior, novo e data no historico', async () => {
    const { repository, tx } = montar();

    await repository.reatribuir(reatribuicao);

    const { data } = argumento(tx.historicoPedidoEntregadores.create);
    expect(data).toMatchObject({
      id_pedido: ID_PEDIDO,
      cpf_entregador_antigo: CPF_ANTERIOR,
      cpf_entregador_novo: CPF_NOVO,
    });
    expect(data.data).toBeInstanceOf(Date);
  });

  it('libera o entregador anterior quando ele fica sem entregas', async () => {
    const { repository, tx } = montar();

    await repository.reatribuir(reatribuicao);

    expect(tx.pedido.count).toHaveBeenCalledWith({
      where: {
        cpf_entregador: CPF_ANTERIOR,
        status: StatusPedido.EM_ANDAMENTO,
      },
    });
    expect(tx.entregador.update).toHaveBeenCalledWith({
      where: { cpf: CPF_ANTERIOR },
      data: { disponivel: true },
    });
  });

  it('mantem o entregador anterior ocupado se ainda tem outra entrega', async () => {
    const { repository, tx } = montar();
    tx.pedido.count.mockResolvedValue(1);

    await repository.reatribuir(reatribuicao);

    expect(tx.entregador.update).not.toHaveBeenCalled();
  });

  it('atribui pedido pendente, marca o inicio e grava antigo como nulo', async () => {
    const { repository, tx } = montar();
    tx.pedido.findUniqueOrThrow.mockResolvedValueOnce({
      ...(await tx.pedido.findUniqueOrThrow()),
      status: StatusPedido.PENDENTE,
      cpf_entregador: null,
    });

    await repository.reatribuir({
      ...reatribuicao,
      statusAtual: StatusPedido.PENDENTE,
      cpfAnterior: null,
    });

    const { where, data } = argumento(tx.pedido.updateMany);
    expect(where).toEqual({
      id_pedido: ID_PEDIDO,
      status: StatusPedido.PENDENTE,
      cpf_entregador: null,
      ganho_consolidado_centavos: null,
    });
    expect(data).toMatchObject({
      cpf_entregador: CPF_NOVO,
      status: StatusPedido.EM_ANDAMENTO,
    });
    expect(data.data_inicio_entrega).toBeInstanceOf(Date);
    expect(
      argumento(tx.historicoPedidoEntregadores.create).data
        .cpf_entregador_antigo,
    ).toBeNull();
    expect(tx.pedido.count).not.toHaveBeenCalled();
  });
});

describe('PedidoRepository.atualizarStatus', () => {
  const atualizacao = {
    idPedido: ID_PEDIDO,
    cpfEntregador: CPF_ANTERIOR,
    statusAtual: StatusPedido.EM_ANDAMENTO,
    novoStatus: StatusPedido.FINALIZADO,
    finalizar: true,
  };

  it('so altera o pedido se o status lido continua o mesmo', async () => {
    const { repository, tx } = montar();

    await repository.atualizarStatus(atualizacao);

    const { where, data } = argumento(tx.pedido.updateMany);
    expect(where).toEqual({
      id_pedido: ID_PEDIDO,
      cpf_entregador: CPF_ANTERIOR,
      status: StatusPedido.EM_ANDAMENTO,
      ganho_consolidado_centavos: null,
    });
    expect(data.status).toBe(StatusPedido.FINALIZADO);
  });

  it('lanca PedidoAlteradoError se nenhuma linha foi alterada', async () => {
    const { repository, tx } = montar();
    tx.pedido.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      repository.atualizarStatus(atualizacao),
    ).rejects.toBeInstanceOf(PedidoAlteradoError);
    expect(tx.entregador.update).not.toHaveBeenCalled();
  });

  it('ao finalizar grava a data e libera o entregador', async () => {
    const { repository, tx } = montar();

    await repository.atualizarStatus(atualizacao);

    const { data } = argumento(tx.pedido.updateMany);
    expect(data.data_finalizacao).toBeInstanceOf(Date);
    expect(tx.entregador.update).toHaveBeenCalledWith({
      where: { cpf: CPF_ANTERIOR },
      data: { disponivel: true },
    });
  });

  it('fora de status final nao grava data nem mexe na disponibilidade', async () => {
    const { repository, tx } = montar();
    tx.pedido.findUniqueOrThrow.mockResolvedValueOnce({
      ...(await tx.pedido.findUniqueOrThrow()),
      status: StatusPedido.PENDENTE,
    });

    await repository.atualizarStatus({
      ...atualizacao,
      statusAtual: StatusPedido.PENDENTE,
      novoStatus: StatusPedido.EM_ANDAMENTO,
      finalizar: false,
    });

    expect(argumento(tx.pedido.updateMany).data).toEqual({
      status: StatusPedido.EM_ANDAMENTO,
    });
    expect(tx.pedido.count).not.toHaveBeenCalled();
    expect(tx.entregador.update).not.toHaveBeenCalled();
  });
});

describe('E-US16: snapshot e consolidacao no repository', () => {
  it('correcao de distancia filtra empresa e estado financeiro sem alterar valor ou snapshot', async () => {
    const { repository: repositorio_pedidos, tx: cliente_transacional } =
      montar();
    await repositorio_pedidos.corrigir_distancia(ID_PEDIDO, ID_EMPRESA, 0);
    expect(argumento(cliente_transacional.pedido.updateMany)).toEqual({
      where: {
        id_pedido: ID_PEDIDO,
        idEmpresa: ID_EMPRESA,
        status: { in: [StatusPedido.PENDENTE, StatusPedido.EM_ANDAMENTO] },
        ganho_consolidado_centavos: null,
      },
      data: { distancia: 0, distancia_conhecida: true },
    });
  });

  it('correcao concorrente com conclusao nao sobrescreve a entrega encerrada', async () => {
    const { repository: repositorio_pedidos, tx: cliente_transacional } =
      montar();
    cliente_transacional.pedido.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      repositorio_pedidos.corrigir_distancia(ID_PEDIDO, ID_EMPRESA, 0),
    ).rejects.toBeInstanceOf(PedidoAlteradoError);
  });

  const conclusao = {
    idPedido: ID_PEDIDO,
    cpfEntregador: CPF_ANTERIOR,
    statusAtual: StatusPedido.EM_ANDAMENTO,
    novoStatus: StatusPedido.FINALIZADO,
    finalizar: true,
  };
  const troca = {
    idPedido: ID_PEDIDO,
    statusAtual: StatusPedido.EM_ANDAMENTO,
    cpfAnterior: CPF_ANTERIOR,
    cpfNovo: CPF_NOVO,
  };

  it('captura parametros na criacao com entregador na mesma transacao', async () => {
    const { repository: repositorio_pedidos, tx: cliente_transacional } =
      montar();
    await repositorio_pedidos.criar(
      { cpf_entregador: CPF_NOVO } as CriaPedidoReqDto,
      ID_EMPRESA,
    );
    const { data: dados_persistidos } = argumento(
      cliente_transacional.pedido.create,
    );
    expect(dados_persistidos).toMatchObject({
      taxa_fixa_atribuicao_centavos: 800,
      coeficiente_atribuicao_centavos_km: 150,
      distancia_conhecida: true,
    });
    expect(dados_persistidos.remuneracao_atribuida_em).toEqual(
      dados_persistidos.data_inicio_entrega,
    );
    expect(
      cliente_transacional.metricasPagamento.findFirst,
    ).toHaveBeenCalledWith({
      where: {
        idEmpresa: ID_EMPRESA,
        data: { lte: dados_persistidos.remuneracao_atribuida_em },
      },
      orderBy: { data: 'desc' },
    });
  });

  it('bloqueia criacao atribuida sem parametros antes de ocupar entregador', async () => {
    const { repository: repositorio_pedidos, tx: cliente_transacional } =
      montar();
    cliente_transacional.metricasPagamento.findFirst.mockResolvedValue(null);
    await expect(
      repositorio_pedidos.criar(
        { cpf_entregador: CPF_NOVO } as CriaPedidoReqDto,
        ID_EMPRESA,
      ),
    ).rejects.toThrow('Configure os parâmetros');
    expect(cliente_transacional.entregador.updateMany).not.toHaveBeenCalled();
    expect(cliente_transacional.pedido.create).not.toHaveBeenCalled();
  });

  it('reatribuicao captura a nova configuracao da empresa do pedido', async () => {
    const { repository: repositorio_pedidos, tx: cliente_transacional } =
      montar();
    cliente_transacional.metricasPagamento.findFirst.mockResolvedValue({
      taxa_fixa: 950,
      coeficiente: 200,
      data: new Date(),
    });
    await repositorio_pedidos.reatribuir(troca);
    expect(
      argumento(cliente_transacional.pedido.updateMany).data,
    ).toMatchObject({
      taxa_fixa_atribuicao_centavos: 950,
      coeficiente_atribuicao_centavos_km: 200,
    });
    expect(
      argumento(cliente_transacional.metricasPagamento.findFirst).where
        .idEmpresa,
    ).toBe(ID_EMPRESA);
  });

  it('nao altera atribuicao quando a captura falha', async () => {
    const { repository: repositorio_pedidos, tx: cliente_transacional } =
      montar();
    cliente_transacional.metricasPagamento.findFirst.mockRejectedValue(
      new Error('falha banco'),
    );
    await expect(repositorio_pedidos.reatribuir(troca)).rejects.toThrow(
      'falha banco',
    );
    expect(cliente_transacional.pedido.updateMany).not.toHaveBeenCalled();
    expect(
      cliente_transacional.historicoPedidoEntregadores.create,
    ).not.toHaveBeenCalled();
  });

  it('consolida com snapshot, preserva valor_entrega e nao consulta parametros vigentes', async () => {
    const { repository: repositorio_pedidos, tx: cliente_transacional } =
      montar();
    await repositorio_pedidos.atualizarStatus(conclusao);
    expect(
      argumento(cliente_transacional.pedido.updateMany).data,
    ).toMatchObject({
      status: StatusPedido.FINALIZADO,
      ganho_consolidado_centavos: 1430,
    });
    expect(
      argumento(cliente_transacional.pedido.updateMany).data,
    ).not.toHaveProperty('valor_entrega');
    expect(
      cliente_transacional.metricasPagamento.findFirst,
    ).not.toHaveBeenCalled();
    expect(
      cliente_transacional.$queryRaw.mock.invocationCallOrder[0],
    ).toBeLessThan(
      cliente_transacional.pedido.findUniqueOrThrow.mock.invocationCallOrder[0],
    );
  });

  it.each([StatusPedido.FINALIZADO, StatusPedido.CANCELADO])(
    'nao recalcula pedido %s, inclusive legado',
    async (status) => {
      const { repository: repositorio_pedidos, tx: cliente_transacional } =
        montar();
      cliente_transacional.pedido.findUniqueOrThrow.mockResolvedValueOnce({
        ...(await cliente_transacional.pedido.findUniqueOrThrow()),
        status,
      });
      await expect(
        repositorio_pedidos.atualizarStatus({
          ...conclusao,
          statusAtual: status,
        }),
      ).rejects.toBeInstanceOf(PedidoAlteradoError);
      expect(cliente_transacional.pedido.updateMany).not.toHaveBeenCalled();
    },
  );

  it('nao conclui nem reatribui um ganho ja consolidado', async () => {
    const { repository: repositorio_pedidos, tx: cliente_transacional } =
      montar();
    cliente_transacional.pedido.findUniqueOrThrow.mockResolvedValue({
      ...(await cliente_transacional.pedido.findUniqueOrThrow()),
      ganho_consolidado_centavos: 0,
    });
    await expect(
      repositorio_pedidos.atualizarStatus(conclusao),
    ).rejects.toBeInstanceOf(PedidoAlteradoError);
    await expect(repositorio_pedidos.reatribuir(troca)).rejects.toBeInstanceOf(
      PedidoAlteradoError,
    );
    expect(cliente_transacional.pedido.updateMany).not.toHaveBeenCalled();
  });

  it('nao conclui por entregador diferente', async () => {
    const { repository: repositorio_pedidos, tx: cliente_transacional } =
      montar();
    await expect(
      repositorio_pedidos.atualizarStatus({
        ...conclusao,
        cpfEntregador: CPF_NOVO,
      }),
    ).rejects.toBeInstanceOf(PedidoAlteradoError);
    expect(cliente_transacional.pedido.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    { distancia_conhecida: false },
    { distancia_conhecida: null },
    { taxa_fixa_atribuicao_centavos: null },
    { distancia: -1 },
    { taxa_fixa_atribuicao_centavos: 2147483647 },
  ])(
    'nao escreve status ou libera entregador quando calculo falha: %j',
    async (campos) => {
      const { repository: repositorio_pedidos, tx: cliente_transacional } =
        montar();
      cliente_transacional.pedido.findUniqueOrThrow.mockResolvedValueOnce({
        ...(await cliente_transacional.pedido.findUniqueOrThrow()),
        ...campos,
      });
      await expect(
        repositorio_pedidos.atualizarStatus(conclusao),
      ).rejects.toThrow();
      expect(cliente_transacional.pedido.updateMany).not.toHaveBeenCalled();
      expect(cliente_transacional.entregador.update).not.toHaveBeenCalled();
    },
  );

  it('repassa falha de persistencia sem liberar o entregador', async () => {
    const { repository: repositorio_pedidos, tx: cliente_transacional } =
      montar();
    cliente_transacional.pedido.updateMany.mockRejectedValue(
      new Error('falha persistencia'),
    );
    await expect(
      repositorio_pedidos.atualizarStatus(conclusao),
    ).rejects.toThrow('falha persistencia');
    expect(cliente_transacional.entregador.update).not.toHaveBeenCalled();
  });
});

describe('PedidoRepository.listarHistoricoDeEntregadores', () => {
  it('busca o historico do pedido em ordem cronologica, so com nomes', async () => {
    const { repository, prisma } = montar();

    await repository.listarHistoricoDeEntregadores(ID_PEDIDO);

    expect(prisma.historicoPedidoEntregadores.findMany).toHaveBeenCalledWith({
      where: { id_pedido: ID_PEDIDO },
      orderBy: { data: 'asc' },
      select: {
        data: true,
        entregadorAntigo: { select: { nome: true } },
        entregadorNovo: { select: { nome: true } },
      },
    });
  });
});

describe('PedidoRepository listagens', () => {
  it('lista os pedidos da empresa com o nome do entregador e a nota, mais novos primeiro', async () => {
    const { repository, prisma } = montar();

    await repository.listarDaEmpresa(ID_EMPRESA);

    expect(prisma.pedido.findMany).toHaveBeenCalledWith({
      where: { idEmpresa: ID_EMPRESA },
      include: {
        entregador: { select: { nome: true } },
        avaliacao: { select: { avaliacao_entrega: true } },
      },
      orderBy: { data_criacao: 'desc' },
    });
  });

  it('lista os pedidos atribuidos ao entregador com o nome da empresa', async () => {
    const { repository, prisma } = montar();

    await repository.listarDoEntregador(CPF_NOVO);

    expect(prisma.pedido.findMany).toHaveBeenCalledWith({
      where: { cpf_entregador: CPF_NOVO },
      include: { empresa: { select: { nome_fantasia: true } } },
      orderBy: { data_criacao: 'desc' },
    });
  });
});
