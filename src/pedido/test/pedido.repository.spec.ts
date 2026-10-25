import { PedidoRepository } from '../pedido.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { CriarPedidoDto } from '../dto/criar-pedido.dto';
import { StatusPedido } from '../../generated/prisma/enums';
import { GanhoEntregaService } from '../../remuneracao/ganho-entrega.service';
import { RemuneracaoRepository } from '../../remuneracao/remuneracao.repository';
import { CalculoValorEntregaService } from '../../remuneracao/calculo-valor-entrega.service';
import {
  EntregadorIndisponivelError,
  PedidoAlteradoError,
} from '../pedido.erros';

const CPF_ANTERIOR = '52998224725';
const CPF_NOVO = '11144477735';
const ID_PEDIDO = 1;
const ID_EMPRESA = 7;

function montar() {
  const parametrosCongelados = {
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
    ...parametrosCongelados,
  };
  const transacao = {
    $queryRaw: jest.fn().mockResolvedValue([{ id_pedido: ID_PEDIDO }]),
    metricasPagamento: {
      findFirst: jest.fn().mockResolvedValue({
        taxa_fixa: 800,
        coeficiente: 150,
        data: parametrosCongelados.parametros_vigentes_desde,
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
      findFirst: jest.fn().mockResolvedValue(null),
    },
    historicoPedidoEntregadores: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn((callback: (cliente: typeof transacao) => unknown) =>
      callback(transacao),
    ),
  };
  const ganhos = new GanhoEntregaService(
    new RemuneracaoRepository(prisma as unknown as PrismaService),
    new CalculoValorEntregaService(),
  );
  const repositorio = new PedidoRepository(
    prisma as unknown as PrismaService,
    ganhos,
  );
  return { repositorio, prisma, transacao };
}

function argumento<T = Record<string, Record<string, unknown>>>(
  mock: jest.Mock,
): T {
  const [[primeiro]] = mock.mock.calls as [[T]];
  return primeiro;
}

describe('PedidoRepository.criar', () => {
  const pedido = { status: StatusPedido.PENDENTE } as CriarPedidoDto;

  it('grava a empresa recebida do token, sem transacao quando nao ha entregador', async () => {
    const { repositorio, prisma } = montar();

    await repositorio.criar(pedido, ID_EMPRESA);

    expect(argumento(prisma.pedido.create).data.idEmpresa).toBe(ID_EMPRESA);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('ocupa o entregador e marca o inicio da entrega ao criar com entregador', async () => {
    const { repositorio, transacao } = montar();

    await repositorio.criar(
      {
        ...pedido,
        status: StatusPedido.EM_ANDAMENTO,
        cpf_entregador: CPF_NOVO,
      },
      ID_EMPRESA,
    );

    expect(transacao.entregador.updateMany).toHaveBeenCalledWith({
      where: { cpf: CPF_NOVO, disponivel: true },
      data: { disponivel: false },
    });
    expect(
      argumento(transacao.pedido.create).data.data_inicio_entrega,
    ).toBeInstanceOf(Date);
  });

  it('abre o historico com o entregador da criacao', async () => {
    const { repositorio, transacao } = montar();

    await repositorio.criar(
      { ...pedido, cpf_entregador: CPF_NOVO },
      ID_EMPRESA,
    );

    const { data } = argumento(transacao.historicoPedidoEntregadores.create);
    expect(data).toMatchObject({
      id_pedido: ID_PEDIDO,
      cpf_entregador_antigo: null,
      cpf_entregador_novo: CPF_NOVO,
    });
    expect(data.data).toEqual(
      argumento(transacao.pedido.create).data.data_inicio_entrega,
    );
  });

  it('nao cria o pedido se o entregador foi ocupado por outra operacao', async () => {
    const { repositorio, transacao } = montar();
    transacao.entregador.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      repositorio.criar({ ...pedido, cpf_entregador: CPF_NOVO }, ID_EMPRESA),
    ).rejects.toBeInstanceOf(EntregadorIndisponivelError);
    expect(transacao.pedido.create).not.toHaveBeenCalled();
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
    const { repositorio, transacao } = montar();

    await repositorio.reatribuir(reatribuicao);

    expect(transacao.pedido.updateMany).toHaveBeenCalledWith({
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
    const { repositorio, transacao } = montar();
    transacao.pedido.updateMany.mockResolvedValue({ count: 0 });

    await expect(repositorio.reatribuir(reatribuicao)).rejects.toBeInstanceOf(
      PedidoAlteradoError,
    );
    expect(transacao.historicoPedidoEntregadores.create).not.toHaveBeenCalled();
  });

  it('ocupa o novo entregador apenas se ele ainda estiver disponivel', async () => {
    const { repositorio, transacao } = montar();

    await repositorio.reatribuir(reatribuicao);

    expect(transacao.entregador.updateMany).toHaveBeenCalledWith({
      where: { cpf: CPF_NOVO, disponivel: true },
      data: { disponivel: false },
    });
  });

  it('lanca EntregadorIndisponivelError se outro pedido ocupou o entregador', async () => {
    const { repositorio, transacao } = montar();
    transacao.entregador.updateMany.mockResolvedValue({ count: 0 });

    await expect(repositorio.reatribuir(reatribuicao)).rejects.toBeInstanceOf(
      EntregadorIndisponivelError,
    );
    expect(transacao.historicoPedidoEntregadores.create).not.toHaveBeenCalled();
  });

  it('registra entregador anterior, novo e data no historico', async () => {
    const { repositorio, transacao } = montar();

    await repositorio.reatribuir(reatribuicao);

    const { data } = argumento(transacao.historicoPedidoEntregadores.create);
    expect(data).toMatchObject({
      id_pedido: ID_PEDIDO,
      cpf_entregador_antigo: CPF_ANTERIOR,
      cpf_entregador_novo: CPF_NOVO,
    });
    expect(data.data).toBeInstanceOf(Date);
  });

  it('libera o entregador anterior quando ele fica sem entregas', async () => {
    const { repositorio, transacao } = montar();

    await repositorio.reatribuir(reatribuicao);

    expect(transacao.pedido.count).toHaveBeenCalledWith({
      where: {
        cpf_entregador: CPF_ANTERIOR,
        status: StatusPedido.EM_ANDAMENTO,
      },
    });
    expect(transacao.entregador.update).toHaveBeenCalledWith({
      where: { cpf: CPF_ANTERIOR },
      data: { disponivel: true },
    });
  });

  it('mantem o entregador anterior ocupado se ainda tem outra entrega', async () => {
    const { repositorio, transacao } = montar();
    transacao.pedido.count.mockResolvedValue(1);

    await repositorio.reatribuir(reatribuicao);

    expect(transacao.entregador.update).not.toHaveBeenCalled();
  });

  it('atribui pedido pendente, marca o inicio e grava antigo como nulo', async () => {
    const { repositorio, transacao } = montar();
    transacao.pedido.findUniqueOrThrow.mockResolvedValueOnce({
      ...(await transacao.pedido.findUniqueOrThrow()),
      status: StatusPedido.PENDENTE,
      cpf_entregador: null,
    });

    await repositorio.reatribuir({
      ...reatribuicao,
      statusAtual: StatusPedido.PENDENTE,
      cpfAnterior: null,
    });

    const { where, data } = argumento(transacao.pedido.updateMany);
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
      argumento(transacao.historicoPedidoEntregadores.create).data
        .cpf_entregador_antigo,
    ).toBeNull();
    expect(transacao.pedido.count).not.toHaveBeenCalled();
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
    const { repositorio, transacao } = montar();

    await repositorio.atualizarStatus(atualizacao);

    const { where, data } = argumento(transacao.pedido.updateMany);
    expect(where).toEqual({
      id_pedido: ID_PEDIDO,
      cpf_entregador: CPF_ANTERIOR,
      status: StatusPedido.EM_ANDAMENTO,
      ganho_consolidado_centavos: null,
    });
    expect(data.status).toBe(StatusPedido.FINALIZADO);
  });

  it('lanca PedidoAlteradoError se nenhuma linha foi alterada', async () => {
    const { repositorio, transacao } = montar();
    transacao.pedido.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      repositorio.atualizarStatus(atualizacao),
    ).rejects.toBeInstanceOf(PedidoAlteradoError);
    expect(transacao.entregador.update).not.toHaveBeenCalled();
  });

  it('ao finalizar grava a data e libera o entregador', async () => {
    const { repositorio, transacao } = montar();

    await repositorio.atualizarStatus(atualizacao);

    const { data } = argumento(transacao.pedido.updateMany);
    expect(data.data_finalizacao).toBeInstanceOf(Date);
    expect(transacao.entregador.update).toHaveBeenCalledWith({
      where: { cpf: CPF_ANTERIOR },
      data: { disponivel: true },
    });
  });

  it('fora de status final nao grava data nem mexe na disponibilidade', async () => {
    const { repositorio, transacao } = montar();
    transacao.pedido.findUniqueOrThrow.mockResolvedValueOnce({
      ...(await transacao.pedido.findUniqueOrThrow()),
      status: StatusPedido.PENDENTE,
    });

    await repositorio.atualizarStatus({
      ...atualizacao,
      statusAtual: StatusPedido.PENDENTE,
      novoStatus: StatusPedido.EM_ANDAMENTO,
      finalizar: false,
    });

    expect(argumento(transacao.pedido.updateMany).data).toEqual({
      status: StatusPedido.EM_ANDAMENTO,
    });
    expect(transacao.pedido.count).not.toHaveBeenCalled();
    expect(transacao.entregador.update).not.toHaveBeenCalled();
  });
});

describe('E-US16: snapshot e consolidacao no repository', () => {
  it('correcao de distancia filtra empresa e estado financeiro sem alterar valor ou snapshot', async () => {
    const { repositorio: repositorioPedidos, transacao: clienteTransacional } =
      montar();
    await repositorioPedidos.corrigirDistancia(ID_PEDIDO, ID_EMPRESA, 0);
    expect(argumento(clienteTransacional.pedido.updateMany)).toEqual({
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
    const { repositorio: repositorioPedidos, transacao: clienteTransacional } =
      montar();
    clienteTransacional.pedido.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      repositorioPedidos.corrigirDistancia(ID_PEDIDO, ID_EMPRESA, 0),
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
    const { repositorio: repositorioPedidos, transacao: clienteTransacional } =
      montar();
    await repositorioPedidos.criar(
      { cpf_entregador: CPF_NOVO } as CriarPedidoDto,
      ID_EMPRESA,
    );
    const { data: dadosPersistidos } = argumento(
      clienteTransacional.pedido.create,
    );
    expect(dadosPersistidos).toMatchObject({
      taxa_fixa_atribuicao_centavos: 800,
      coeficiente_atribuicao_centavos_km: 150,
      distancia_conhecida: true,
    });
    expect(dadosPersistidos.remuneracao_atribuida_em).toEqual(
      dadosPersistidos.data_inicio_entrega,
    );
    expect(
      clienteTransacional.metricasPagamento.findFirst,
    ).toHaveBeenCalledWith({
      where: {
        idEmpresa: ID_EMPRESA,
        data: { lte: dadosPersistidos.remuneracao_atribuida_em },
      },
      orderBy: { data: 'desc' },
    });
  });

  it('bloqueia criacao atribuida sem parametros antes de ocupar entregador', async () => {
    const { repositorio: repositorioPedidos, transacao: clienteTransacional } =
      montar();
    clienteTransacional.metricasPagamento.findFirst.mockResolvedValue(null);
    await expect(
      repositorioPedidos.criar(
        { cpf_entregador: CPF_NOVO } as CriarPedidoDto,
        ID_EMPRESA,
      ),
    ).rejects.toThrow('Configure os parâmetros');
    expect(clienteTransacional.entregador.updateMany).not.toHaveBeenCalled();
    expect(clienteTransacional.pedido.create).not.toHaveBeenCalled();
  });

  it('reatribuicao captura a nova configuracao da empresa do pedido', async () => {
    const { repositorio: repositorioPedidos, transacao: clienteTransacional } =
      montar();
    clienteTransacional.metricasPagamento.findFirst.mockResolvedValue({
      taxa_fixa: 950,
      coeficiente: 200,
      data: new Date(),
    });
    await repositorioPedidos.reatribuir(troca);
    expect(argumento(clienteTransacional.pedido.updateMany).data).toMatchObject(
      {
        taxa_fixa_atribuicao_centavos: 950,
        coeficiente_atribuicao_centavos_km: 200,
      },
    );
    expect(
      argumento(clienteTransacional.metricasPagamento.findFirst).where
        .idEmpresa,
    ).toBe(ID_EMPRESA);
  });

  it('nao altera atribuicao quando a captura falha', async () => {
    const { repositorio: repositorioPedidos, transacao: clienteTransacional } =
      montar();
    clienteTransacional.metricasPagamento.findFirst.mockRejectedValue(
      new Error('falha banco'),
    );
    await expect(repositorioPedidos.reatribuir(troca)).rejects.toThrow(
      'falha banco',
    );
    expect(clienteTransacional.pedido.updateMany).not.toHaveBeenCalled();
    expect(
      clienteTransacional.historicoPedidoEntregadores.create,
    ).not.toHaveBeenCalled();
  });

  it('consolida com snapshot, preserva valor_entrega e nao consulta parametros vigentes', async () => {
    const { repositorio: repositorioPedidos, transacao: clienteTransacional } =
      montar();
    await repositorioPedidos.atualizarStatus(conclusao);
    expect(argumento(clienteTransacional.pedido.updateMany).data).toMatchObject(
      {
        status: StatusPedido.FINALIZADO,
        ganho_consolidado_centavos: 1430,
      },
    );
    expect(
      argumento(clienteTransacional.pedido.updateMany).data,
    ).not.toHaveProperty('valor_entrega');
    expect(
      clienteTransacional.metricasPagamento.findFirst,
    ).not.toHaveBeenCalled();
    expect(
      clienteTransacional.$queryRaw.mock.invocationCallOrder[0],
    ).toBeLessThan(
      clienteTransacional.pedido.findUniqueOrThrow.mock.invocationCallOrder[0],
    );
  });

  it.each([StatusPedido.FINALIZADO, StatusPedido.CANCELADO])(
    'nao recalcula pedido %s, inclusive legado',
    async (status) => {
      const {
        repositorio: repositorioPedidos,
        transacao: clienteTransacional,
      } = montar();
      clienteTransacional.pedido.findUniqueOrThrow.mockResolvedValueOnce({
        ...(await clienteTransacional.pedido.findUniqueOrThrow()),
        status,
      });
      await expect(
        repositorioPedidos.atualizarStatus({
          ...conclusao,
          statusAtual: status,
        }),
      ).rejects.toBeInstanceOf(PedidoAlteradoError);
      expect(clienteTransacional.pedido.updateMany).not.toHaveBeenCalled();
    },
  );

  it('nao conclui nem reatribui um ganho ja consolidado', async () => {
    const { repositorio: repositorioPedidos, transacao: clienteTransacional } =
      montar();
    clienteTransacional.pedido.findUniqueOrThrow.mockResolvedValue({
      ...(await clienteTransacional.pedido.findUniqueOrThrow()),
      ganho_consolidado_centavos: 0,
    });
    await expect(
      repositorioPedidos.atualizarStatus(conclusao),
    ).rejects.toBeInstanceOf(PedidoAlteradoError);
    await expect(repositorioPedidos.reatribuir(troca)).rejects.toBeInstanceOf(
      PedidoAlteradoError,
    );
    expect(clienteTransacional.pedido.updateMany).not.toHaveBeenCalled();
  });

  it('nao conclui por entregador diferente', async () => {
    const { repositorio: repositorioPedidos, transacao: clienteTransacional } =
      montar();
    await expect(
      repositorioPedidos.atualizarStatus({
        ...conclusao,
        cpfEntregador: CPF_NOVO,
      }),
    ).rejects.toBeInstanceOf(PedidoAlteradoError);
    expect(clienteTransacional.pedido.updateMany).not.toHaveBeenCalled();
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
      const {
        repositorio: repositorioPedidos,
        transacao: clienteTransacional,
      } = montar();
      clienteTransacional.pedido.findUniqueOrThrow.mockResolvedValueOnce({
        ...(await clienteTransacional.pedido.findUniqueOrThrow()),
        ...campos,
      });
      await expect(
        repositorioPedidos.atualizarStatus(conclusao),
      ).rejects.toThrow();
      expect(clienteTransacional.pedido.updateMany).not.toHaveBeenCalled();
      expect(clienteTransacional.entregador.update).not.toHaveBeenCalled();
    },
  );

  it('repassa falha de persistencia sem liberar o entregador', async () => {
    const { repositorio: repositorioPedidos, transacao: clienteTransacional } =
      montar();
    clienteTransacional.pedido.updateMany.mockRejectedValue(
      new Error('falha persistencia'),
    );
    await expect(repositorioPedidos.atualizarStatus(conclusao)).rejects.toThrow(
      'falha persistencia',
    );
    expect(clienteTransacional.entregador.update).not.toHaveBeenCalled();
  });
});

describe('PedidoRepository.listarHistoricoDeEntregadores', () => {
  it('busca o historico do pedido em ordem cronologica, so com nomes', async () => {
    const { repositorio, prisma } = montar();

    await repositorio.listarHistoricoDeEntregadores(ID_PEDIDO);

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
    const { repositorio, prisma } = montar();

    await repositorio.listarDaEmpresa(ID_EMPRESA);

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
    const { repositorio, prisma } = montar();

    await repositorio.listarDoEntregador(CPF_NOVO);

    expect(prisma.pedido.findMany).toHaveBeenCalledWith({
      where: { cpf_entregador: CPF_NOVO },
      include: { empresa: { select: { nome_fantasia: true } } },
      orderBy: { data_criacao: 'desc' },
    });
  });
});

describe('PedidoRepository buscas de um pedido', () => {
  it('procura o pedido so entre os da empresa', async () => {
    const { repositorio, prisma } = montar();

    await repositorio.procurarPorEmpresa(ID_PEDIDO, ID_EMPRESA);

    expect(prisma.pedido.findFirst).toHaveBeenCalledWith({
      where: { id_pedido: ID_PEDIDO, idEmpresa: ID_EMPRESA },
    });
  });

  it('traz o detalhe da empresa com o nome do entregador', async () => {
    const { repositorio, prisma } = montar();

    await repositorio.procurarDetalheDaEmpresa(ID_PEDIDO, ID_EMPRESA);

    expect(prisma.pedido.findFirst).toHaveBeenCalledWith({
      where: { id_pedido: ID_PEDIDO, idEmpresa: ID_EMPRESA },
      include: { entregador: { select: { nome: true } } },
    });
  });

  it('procura o pedido so entre os atribuidos ao entregador', async () => {
    const { repositorio, prisma } = montar();

    await repositorio.procurarAtribuidoAoEntregador(ID_PEDIDO, CPF_NOVO);

    expect(prisma.pedido.findFirst).toHaveBeenCalledWith({
      where: { id_pedido: ID_PEDIDO, cpf_entregador: CPF_NOVO },
    });
  });

  it('traz os telefones da empresa e do entregador filtrando pelo dono', async () => {
    const { repositorio, prisma } = montar();

    await repositorio.procurarComContatos(ID_PEDIDO, {
      cpf_entregador: CPF_NOVO,
    });

    expect(prisma.pedido.findFirst).toHaveBeenCalledWith({
      where: { id_pedido: ID_PEDIDO, cpf_entregador: CPF_NOVO },
      include: {
        empresa: { select: { nome_fantasia: true, telefone: true } },
        entregador: { select: { nome: true, telefone: true } },
      },
    });
  });
});
