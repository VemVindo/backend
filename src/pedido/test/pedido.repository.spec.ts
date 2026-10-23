import { Test, TestingModule } from '@nestjs/testing';
import { PedidoRepository } from '../pedido.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { Pedido } from '../../generated/prisma/client';
import { CriaPedidoReqDto } from '../dto/cria-pedido.dto';
import { StatusPedido } from '../../generated/prisma/enums';
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

// Simula o PrismaService: $transaction executa o callback com o cliente tx.
function montar() {
  const tx = {
    pedido: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({ id_pedido: ID_PEDIDO }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        id_pedido: ID_PEDIDO,
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
  const repository = new PedidoRepository(prisma as unknown as PrismaService);
  return { repository, prisma, tx };
}

// Argumento da primeira chamada de um mock, tipado para as asserções.
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
      },
      data: { cpf_entregador: CPF_NOVO, status: StatusPedido.EM_ANDAMENTO },
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

    await repository.atualizarStatus({ ...atualizacao, finalizar: false });

    expect(argumento(tx.pedido.updateMany).data).toEqual({
      status: StatusPedido.FINALIZADO,
    });
    expect(tx.pedido.count).not.toHaveBeenCalled();
    expect(tx.entregador.update).not.toHaveBeenCalled();
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
