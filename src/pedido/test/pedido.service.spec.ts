import {
  ConflictException,
  HttpStatus,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PedidoService } from '../pedido.service';
import { PedidoRepository } from '../pedido.repository';
import { LocalizacaoService } from '../../mapa/localizacao.service';
import { EntregadorRepository } from '../../entregador/entregador.repository';
import { CriaPedidoReqDto } from '../dto/cria-pedido.dto';
import { Pedido } from '../../generated/prisma/client';
import { StatusPedido } from '../../generated/prisma/enums';
import {
  EntregadorIndisponivelError,
  PedidoAlteradoError,
} from '../pedido.erros';
import {
  CodigoDoRecebedorService,
  ConferenciaDoCodigo,
} from '../../rastreio/codigo-do-recebedor.service';
import { RemuneracaoService } from '../../remuneracao/remuneracao.service';
import { CalculoValorEntregaService } from '../../remuneracao/calculo-valor-entrega.service';
import { GoogleMapsClient } from '../../mapa/google-maps.client';

jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: class {},
}));

describe('PedidoService', () => {
  let service: PedidoService;
  let repository: PedidoRepository;

  describe('CRIAR', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PedidoService,
          {
            provide: PedidoRepository,
            useValue: { criar: jest.fn() },
          },
          {
            provide: EntregadorRepository,
            useValue: {
              procurarAtivoPorEmpresa: jest
                .fn()
                .mockResolvedValue({ disponivel: true }),
            },
          },
          { provide: LocalizacaoService, useValue: {} },
          { provide: CodigoDoRecebedorService, useValue: {} },
          {
            provide: RemuneracaoService,
            useValue: {
              consultar: jest
                .fn()
                .mockResolvedValue({ taxaFixa: 500, coeficienteKm: 100 }),
            },
          },
          {
            provide: CalculoValorEntregaService,
            useValue: {
              calcularValorEntrega: jest.fn().mockReturnValue(1500),
            },
          },
          {
            provide: GoogleMapsClient,
            useValue: {
              calcularRota: jest.fn().mockResolvedValue({ distanciaM: 2000 }),
            },
          },
        ],
      }).compile();
      service = module.get<PedidoService>(PedidoService);
      repository = module.get<PedidoRepository>(PedidoRepository);
    });

    it('CAIXA BRANCA: Entregador sem CPF', async () => {
      const dummy = {} as CriaPedidoReqDto;
      const spy = jest.spyOn(repository, 'criar');
      await service.criar(1, dummy);
      expect(spy.mock.calls[0][0].status).toBe(StatusPedido.PENDENTE);
      expect(spy.mock.calls[0][0].cpf_entregador).toBeUndefined();
    });

    it('CAIXA BRANCA: Entregador com CPF', async () => {
      const stub = {
        cpf_entregador: 'teste',
      };
      const spy = jest.spyOn(repository, 'criar');
      await service.criar(1, stub as CriaPedidoReqDto);
      expect(spy.mock.calls[0][0].status).toBe(StatusPedido.EM_ANDAMENTO);
      expect(spy.mock.calls[0][0].cpf_entregador).not.toBeUndefined();
    });

    it('CAIXA BRANCA: Data Criacao', async () => {
      const stub = {
        cpf_entregador: 'teste',
      };
      const spy = jest.spyOn(repository, 'criar');
      await service.criar(1, stub as CriaPedidoReqDto);
      expect(spy.mock.calls[0][0].data_criacao).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/, //Formato ISOString pra datas
      );
    });

    it('CAIXA CINZA: Fluxo Completo', () => {
      const dummyReq = {} as CriaPedidoReqDto;
      const dummyRes = {} as Promise<Pedido>;
      jest.spyOn(repository, 'criar').mockImplementation(() => dummyRes);
      const result = service.criar(1, dummyReq);
      expect(result).toBeInstanceOf(Promise<Pedido>);
    });
  });
});

const CPF_ENTREGADOR = '52998224725';
const NOVO_CPF = '11144477735';
const ID_EMPRESA = 1;
const ID_PEDIDO = 1;
const DATA_CRIACAO = new Date('2026-10-07T17:02:00Z');

const pedidoPendente = {
  id_pedido: ID_PEDIDO,
  nome_recebedor: 'Carla Menezes',
  data_criacao: DATA_CRIACAO,
  cpf_entregador: null,
  status: StatusPedido.PENDENTE,
  valor_entrega: 1430,
  data_finalizacao: null,
};

const pedidoEmAndamento = {
  ...pedidoPendente,
  cpf_entregador: CPF_ENTREGADOR,
  status: StatusPedido.EM_ANDAMENTO,
};

const novoEntregador = {
  cpf: NOVO_CPF,
  disponivel: true,
};

function montar() {
  const pedidos = {
    procurarAtribuidoAoEntregador: jest
      .fn()
      .mockResolvedValue(pedidoEmAndamento),

    procurarPorEmpresa: jest.fn().mockResolvedValue(pedidoEmAndamento),

    procurarDetalheDaEmpresa: jest.fn().mockResolvedValue(null),

    criar: jest.fn().mockResolvedValue(pedidoPendente),
    corrigirDistancia: jest
      .fn()
      .mockResolvedValue({ ...pedidoEmAndamento, entregador: null }),

    listarDaEmpresa: jest
      .fn()
      .mockResolvedValue([{ ...pedidoPendente, entregador: null }]),

    listarDoEntregador: jest.fn().mockResolvedValue([
      {
        ...pedidoEmAndamento,
        logradouro: 'Rua das Flores',
        numero: 10,
        complemento: null,
        bairro: 'Centro',
        cidade: 'Brasilia',
        uf: 'DF',
        valor_entrega: 1430,
        distancia: 4200,
        data_inicio_entrega: DATA_CRIACAO,
        data_finalizacao: null,
        empresa: { nome_fantasia: 'Cantina Dona Marta' },
      },
    ]),

    listarHistoricoDeEntregadores: jest.fn().mockResolvedValue([
      {
        data: DATA_CRIACAO,
        entregadorAntigo: null,
        entregadorNovo: { nome: 'Bruno Lima' },
      },
    ]),

    atualizarStatus: jest
      .fn()
      .mockImplementation(
        (dados: { idPedido: number; novoStatus: StatusPedido }) =>
          Promise.resolve({
            ...pedidoEmAndamento,
            id_pedido: dados.idPedido,
            status: dados.novoStatus,
            entregador: { nome: 'Bruno Lima' },
          }),
      ),

    reatribuir: jest
      .fn()
      .mockImplementation((dados: { idPedido: number; cpfNovo: string }) =>
        Promise.resolve({
          ...pedidoEmAndamento,
          id_pedido: dados.idPedido,
          cpf_entregador: dados.cpfNovo,
          entregador: { nome: 'Ana Souza' },
        }),
      ),
  };

  const entregadores = {
    procurarAtivoPorEmpresa: jest.fn().mockResolvedValue(novoEntregador),
  };

  const localizacao = {
    aoMudarStatus: jest.fn().mockResolvedValue(undefined),
    aoTrocarEntregador: jest.fn().mockResolvedValue(undefined),
  };

  const codigoDoRecebedor = {
    conferir: jest
      .fn<
        Promise<ConferenciaDoCodigo>,
        Parameters<CodigoDoRecebedorService['conferir']>
      >()
      .mockResolvedValue({ situacao: 'correto' }),
  };

  const remuneracaoService = {
    consultar: jest.fn().mockResolvedValue({
      taxaFixa: 5.0,
      coeficienteKm: 1.5,
    }),
  };

  const calculoValorEntregaService = {
    calcularValorEntrega: jest.fn(),
  };

  const googleMapsClient = {
    calcularRota: jest.fn().mockResolvedValue({
      distanciaM: 10,
    }),
  };

  const service = new PedidoService(
    pedidos as unknown as PedidoRepository,
    entregadores as unknown as EntregadorRepository,
    localizacao as unknown as LocalizacaoService,
    codigoDoRecebedor as unknown as CodigoDoRecebedorService,
    remuneracaoService as unknown as RemuneracaoService,
    calculoValorEntregaService as unknown as CalculoValorEntregaService,
    googleMapsClient as unknown as GoogleMapsClient,
  );

  return {
    service,
    pedidos,
    entregadores,
    localizacao,
    codigoDoRecebedor,
    remuneracaoService,
    calculoValorEntregaService,
    googleMapsClient,
  };
}

describe('PedidoService.atualizarStatus', () => {
  it('responde 404 quando o pedido nao esta atribuido ao entregador', async () => {
    const { service, pedidos } = montar();
    pedidos.procurarAtribuidoAoEntregador.mockResolvedValue(null);

    await expect(
      service.atualizarStatus(
        CPF_ENTREGADOR,
        ID_PEDIDO,
        StatusPedido.EM_ANDAMENTO,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('recusa uma transicao de status incompativel sem gravar', async () => {
    const { service, pedidos } = montar();

    await expect(
      service.atualizarStatus(CPF_ENTREGADOR, ID_PEDIDO, StatusPedido.PENDENTE),
    ).rejects.toThrow(ConflictException);
    expect(pedidos.atualizarStatus).not.toHaveBeenCalled();
  });

  it('recusa finalizar pela troca de status, que nao pede o codigo', async () => {
    const { service, pedidos, codigoDoRecebedor } = montar();

    await expect(
      service.atualizarStatus(
        CPF_ENTREGADOR,
        ID_PEDIDO,
        StatusPedido.FINALIZADO,
      ),
    ).rejects.toThrow(
      'Para finalizar a entrega, informe o código do recebedor',
    );
    expect(codigoDoRecebedor.conferir).not.toHaveBeenCalled();
    expect(pedidos.atualizarStatus).not.toHaveBeenCalled();
  });

  it('busca o pedido usando o id e o cpf do entregador', async () => {
    const { service, pedidos } = montar();
    pedidos.procurarAtribuidoAoEntregador.mockResolvedValue(pedidoPendente);

    await service.atualizarStatus(
      CPF_ENTREGADOR,
      ID_PEDIDO,
      StatusPedido.EM_ANDAMENTO,
    );

    expect(pedidos.procurarAtribuidoAoEntregador).toHaveBeenCalledWith(
      ID_PEDIDO,
      CPF_ENTREGADOR,
    );
  });

  it('grava condicionado ao status lido sem finalizar', async () => {
    const { service, pedidos } = montar();
    pedidos.procurarAtribuidoAoEntregador.mockResolvedValue(pedidoPendente);

    await service.atualizarStatus(
      CPF_ENTREGADOR,
      ID_PEDIDO,
      StatusPedido.EM_ANDAMENTO,
    );

    expect(pedidos.atualizarStatus).toHaveBeenCalledWith({
      idPedido: ID_PEDIDO,
      cpfEntregador: CPF_ENTREGADOR,
      statusAtual: StatusPedido.PENDENTE,
      novoStatus: StatusPedido.EM_ANDAMENTO,
      finalizar: false,
    });
  });

  it('retorna o resumo do pedido no mesmo formato da reatribuicao', async () => {
    const { service, pedidos } = montar();
    pedidos.procurarAtribuidoAoEntregador.mockResolvedValue(pedidoPendente);

    await expect(
      service.atualizarStatus(
        CPF_ENTREGADOR,
        ID_PEDIDO,
        StatusPedido.EM_ANDAMENTO,
      ),
    ).resolves.toEqual({
      id: ID_PEDIDO,
      recebedor: 'Carla Menezes',
      entregador: 'Bruno Lima',
      status: StatusPedido.EM_ANDAMENTO,
      criadoEm: DATA_CRIACAO,
      valorEntrega: 1430,
      ganhoConsolidadoCentavos: null,
      distanciaConhecida: null,
      finalizadoEm: null,
      nota: null,
    });
  });

  it('responde 409 quando o pedido mudou entre a leitura e a escrita', async () => {
    const { service, pedidos } = montar();
    pedidos.procurarAtribuidoAoEntregador.mockResolvedValue(pedidoPendente);
    pedidos.atualizarStatus.mockRejectedValue(new PedidoAlteradoError());

    await expect(
      service.atualizarStatus(
        CPF_ENTREGADOR,
        ID_PEDIDO,
        StatusPedido.EM_ANDAMENTO,
      ),
    ).rejects.toThrow(ConflictException);
  });
});

describe('PedidoService.finalizar', () => {
  const CODIGO = '482913';

  it('confere o codigo do pedido e grava a finalizacao liberando o entregador', async () => {
    const { service, pedidos, codigoDoRecebedor } = montar();

    await service.finalizar(CPF_ENTREGADOR, ID_PEDIDO, CODIGO);

    expect(codigoDoRecebedor.conferir).toHaveBeenCalledWith(ID_PEDIDO, CODIGO);
    expect(pedidos.atualizarStatus).toHaveBeenCalledWith({
      idPedido: ID_PEDIDO,
      cpfEntregador: CPF_ENTREGADOR,
      statusAtual: StatusPedido.EM_ANDAMENTO,
      novoStatus: StatusPedido.FINALIZADO,
      finalizar: true,
    });
  });

  it('retorna o resumo do pedido finalizado', async () => {
    const { service } = montar();

    await expect(
      service.finalizar(CPF_ENTREGADOR, ID_PEDIDO, CODIGO),
    ).resolves.toMatchObject({
      id: ID_PEDIDO,
      status: StatusPedido.FINALIZADO,
    });
  });

  it('responde 404 quando o pedido nao esta atribuido ao entregador', async () => {
    const { service, pedidos, codigoDoRecebedor } = montar();
    pedidos.procurarAtribuidoAoEntregador.mockResolvedValue(null);

    await expect(
      service.finalizar(CPF_ENTREGADOR, ID_PEDIDO, CODIGO),
    ).rejects.toThrow(NotFoundException);
    expect(codigoDoRecebedor.conferir).not.toHaveBeenCalled();
  });

  it('nao gasta tentativa quando o pedido nao esta em andamento', async () => {
    const { service, pedidos, codigoDoRecebedor } = montar();
    pedidos.procurarAtribuidoAoEntregador.mockResolvedValue(pedidoPendente);

    await expect(
      service.finalizar(CPF_ENTREGADOR, ID_PEDIDO, CODIGO),
    ).rejects.toThrow(ConflictException);
    expect(codigoDoRecebedor.conferir).not.toHaveBeenCalled();
  });

  it('responde 422 com as tentativas restantes quando o codigo esta errado', async () => {
    const { service, pedidos, codigoDoRecebedor } = montar();
    codigoDoRecebedor.conferir.mockResolvedValue({
      situacao: 'incorreto',
      tentativasRestantes: 3,
    });

    const erro = await service
      .finalizar(CPF_ENTREGADOR, ID_PEDIDO, CODIGO)
      .catch((falha: unknown) => falha);

    expect(erro).toBeInstanceOf(UnprocessableEntityException);
    expect((erro as UnprocessableEntityException).getResponse()).toEqual({
      message: 'Código incorreto',
      tentativasRestantes: 3,
    });
    expect(pedidos.atualizarStatus).not.toHaveBeenCalled();
  });

  it('responde 429 com o horario de liberacao quando esta bloqueado', async () => {
    const { service, pedidos, codigoDoRecebedor } = montar();
    const liberaEm = new Date('2026-10-22T15:00:00Z');
    codigoDoRecebedor.conferir.mockResolvedValue({
      situacao: 'bloqueado',
      liberaEm,
    });

    const erro = await service
      .finalizar(CPF_ENTREGADOR, ID_PEDIDO, CODIGO)
      .catch((falha: unknown) => falha);

    expect((erro as UnprocessableEntityException).getStatus()).toBe(
      HttpStatus.TOO_MANY_REQUESTS,
    );
    expect((erro as UnprocessableEntityException).getResponse()).toMatchObject({
      liberaEm,
    });
    expect(pedidos.atualizarStatus).not.toHaveBeenCalled();
  });

  it('responde 409 quando o recebedor ainda nao tem codigo', async () => {
    const { service, pedidos, codigoDoRecebedor } = montar();
    codigoDoRecebedor.conferir.mockResolvedValue({ situacao: 'sem_codigo' });

    await expect(
      service.finalizar(CPF_ENTREGADOR, ID_PEDIDO, CODIGO),
    ).rejects.toThrow(ConflictException);
    expect(pedidos.atualizarStatus).not.toHaveBeenCalled();
  });
});

describe('PedidoService.obterStatusDisponiveis', () => {
  it('tira a finalizacao dos botoes de status e indica que ela pede o codigo', async () => {
    const { service } = montar();

    await expect(
      service.obterStatusDisponiveis(CPF_ENTREGADOR, ID_PEDIDO),
    ).resolves.toEqual({
      statusAtual: StatusPedido.EM_ANDAMENTO,
      statusDisponiveis: [],
      podeFinalizarComCodigo: true,
    });
  });

  it('nao oferece finalizar um pedido pendente', async () => {
    const { service, pedidos } = montar();
    pedidos.procurarAtribuidoAoEntregador.mockResolvedValue(pedidoPendente);

    await expect(
      service.obterStatusDisponiveis(CPF_ENTREGADOR, ID_PEDIDO),
    ).resolves.toEqual({
      statusAtual: StatusPedido.PENDENTE,
      statusDisponiveis: [StatusPedido.EM_ANDAMENTO],
      podeFinalizarComCodigo: false,
    });
  });

  it('responde 404 quando o pedido nao esta atribuido ao entregador', async () => {
    const { service, pedidos } = montar();
    pedidos.procurarAtribuidoAoEntregador.mockResolvedValue(null);

    await expect(
      service.obterStatusDisponiveis(CPF_ENTREGADOR, ID_PEDIDO),
    ).rejects.toThrow(NotFoundException);
  });

  it('retorna lista vazia para um pedido finalizado', async () => {
    const { service, pedidos } = montar();
    pedidos.procurarAtribuidoAoEntregador.mockResolvedValue({
      ...pedidoEmAndamento,
      status: StatusPedido.FINALIZADO,
    });

    await expect(
      service.obterStatusDisponiveis(CPF_ENTREGADOR, ID_PEDIDO),
    ).resolves.toEqual({
      statusAtual: StatusPedido.FINALIZADO,
      statusDisponiveis: [],
      podeFinalizarComCodigo: false,
    });
  });
});

describe('PedidoService.reatribuir', () => {
  it('responde 404 quando o pedido nao pertence a empresa', async () => {
    const { service, pedidos } = montar();
    pedidos.procurarPorEmpresa.mockResolvedValue(null);

    await expect(
      service.reatribuir(ID_EMPRESA, ID_PEDIDO, NOVO_CPF),
    ).rejects.toThrow(NotFoundException);
  });

  it.each([StatusPedido.FINALIZADO, StatusPedido.CANCELADO])(
    'recusa reatribuicao de pedido %s sem gravar',
    async (status) => {
      const { service, pedidos } = montar();
      pedidos.procurarPorEmpresa.mockResolvedValue({
        ...pedidoEmAndamento,
        status,
      });

      await expect(
        service.reatribuir(ID_EMPRESA, ID_PEDIDO, NOVO_CPF),
      ).rejects.toThrow(ConflictException);
      expect(pedidos.reatribuir).not.toHaveBeenCalled();
    },
  );

  it('atribui o entregador a um pedido pendente sem entregador', async () => {
    const { service, pedidos } = montar();
    pedidos.procurarPorEmpresa.mockResolvedValue(pedidoPendente);

    await service.reatribuir(ID_EMPRESA, ID_PEDIDO, NOVO_CPF);

    expect(pedidos.reatribuir).toHaveBeenCalledWith({
      idPedido: ID_PEDIDO,
      statusAtual: StatusPedido.PENDENTE,
      cpfAnterior: null,
      cpfNovo: NOVO_CPF,
    });
  });

  it('recusa reatribuicao para o entregador atual', async () => {
    const { service } = montar();

    await expect(
      service.reatribuir(ID_EMPRESA, ID_PEDIDO, CPF_ENTREGADOR),
    ).rejects.toThrow(ConflictException);
  });

  it('responde 404 quando o novo entregador nao possui vinculo ativo com a empresa', async () => {
    const { service, entregadores } = montar();
    entregadores.procurarAtivoPorEmpresa.mockResolvedValue(null);

    await expect(
      service.reatribuir(ID_EMPRESA, ID_PEDIDO, NOVO_CPF),
    ).rejects.toThrow(NotFoundException);
  });

  it('recusa reatribuicao quando o novo entregador esta indisponivel', async () => {
    const { service, entregadores, pedidos } = montar();
    entregadores.procurarAtivoPorEmpresa.mockResolvedValue({
      ...novoEntregador,
      disponivel: false,
    });

    await expect(
      service.reatribuir(ID_EMPRESA, ID_PEDIDO, NOVO_CPF),
    ).rejects.toThrow(ConflictException);
    expect(pedidos.reatribuir).not.toHaveBeenCalled();
  });

  it('troca o entregador condicionado ao status e ao entregador lidos', async () => {
    const { service, pedidos } = montar();

    await service.reatribuir(ID_EMPRESA, ID_PEDIDO, NOVO_CPF);

    expect(pedidos.reatribuir).toHaveBeenCalledWith({
      idPedido: ID_PEDIDO,
      statusAtual: StatusPedido.EM_ANDAMENTO,
      cpfAnterior: CPF_ENTREGADOR,
      cpfNovo: NOVO_CPF,
    });
  });

  it('retorna o pedido com o novo entregador', async () => {
    const { service } = montar();

    await expect(
      service.reatribuir(ID_EMPRESA, ID_PEDIDO, NOVO_CPF),
    ).resolves.toEqual({
      id: ID_PEDIDO,
      recebedor: 'Carla Menezes',
      entregador: 'Ana Souza',
      status: StatusPedido.EM_ANDAMENTO,
      criadoEm: DATA_CRIACAO,
      valorEntrega: 1430,
      ganhoConsolidadoCentavos: null,
      distanciaConhecida: null,
      finalizadoEm: null,
      nota: null,
    });
  });

  it.each([
    ['o pedido mudou', new PedidoAlteradoError()],
    ['o entregador ficou indisponivel', new EntregadorIndisponivelError()],
  ])('responde 409 quando %s durante a gravacao', async (_caso, erro) => {
    const { service, pedidos } = montar();
    pedidos.reatribuir.mockRejectedValue(erro);

    await expect(
      service.reatribuir(ID_EMPRESA, ID_PEDIDO, NOVO_CPF),
    ).rejects.toThrow(ConflictException);
  });

  it('repassa erros que nao sao de concorrencia', async () => {
    const { service, pedidos } = montar();
    const falha = new Error('conexao perdida');
    pedidos.reatribuir.mockRejectedValue(falha);

    await expect(
      service.reatribuir(ID_EMPRESA, ID_PEDIDO, NOVO_CPF),
    ).rejects.toBe(falha);
  });
});

describe('PedidoService.atribuir', () => {
  it('responde 404 quando o pedido nao pertence a empresa', async () => {
    const { service, pedidos } = montar();
    pedidos.procurarPorEmpresa.mockResolvedValue(null);

    await expect(
      service.atribuir(ID_EMPRESA, ID_PEDIDO, NOVO_CPF),
    ).rejects.toThrow(NotFoundException);
  });

  it.each([
    ['ja tem entregador', pedidoEmAndamento],
    [
      'esta finalizado',
      { ...pedidoEmAndamento, status: StatusPedido.FINALIZADO },
    ],
    ['esta cancelado', { ...pedidoPendente, status: StatusPedido.CANCELADO }],
  ])(
    'recusa atribuir quando o pedido %s, sem gravar',
    async (_caso, pedido) => {
      const { service, pedidos } = montar();
      pedidos.procurarPorEmpresa.mockResolvedValue(pedido);

      await expect(
        service.atribuir(ID_EMPRESA, ID_PEDIDO, NOVO_CPF),
      ).rejects.toThrow(ConflictException);
      expect(pedidos.reatribuir).not.toHaveBeenCalled();
    },
  );

  it('responde 404 quando o entregador nao e da frota da empresa', async () => {
    const { service, pedidos, entregadores } = montar();
    pedidos.procurarPorEmpresa.mockResolvedValue(pedidoPendente);
    entregadores.procurarAtivoPorEmpresa.mockResolvedValue(null);

    await expect(
      service.atribuir(ID_EMPRESA, ID_PEDIDO, NOVO_CPF),
    ).rejects.toThrow(NotFoundException);
  });

  it('recusa entregador indisponivel sem gravar', async () => {
    const { service, pedidos, entregadores } = montar();
    pedidos.procurarPorEmpresa.mockResolvedValue(pedidoPendente);
    entregadores.procurarAtivoPorEmpresa.mockResolvedValue({
      ...novoEntregador,
      disponivel: false,
    });

    await expect(
      service.atribuir(ID_EMPRESA, ID_PEDIDO, NOVO_CPF),
    ).rejects.toThrow(ConflictException);
    expect(pedidos.reatribuir).not.toHaveBeenCalled();
  });

  it('grava o primeiro entregador condicionado ao pedido pendente', async () => {
    const { service, pedidos } = montar();
    pedidos.procurarPorEmpresa.mockResolvedValue(pedidoPendente);

    await service.atribuir(ID_EMPRESA, ID_PEDIDO, NOVO_CPF);

    expect(pedidos.reatribuir).toHaveBeenCalledWith({
      idPedido: ID_PEDIDO,
      statusAtual: StatusPedido.PENDENTE,
      cpfAnterior: null,
      cpfNovo: NOVO_CPF,
    });
  });

  it('responde 409 quando outro usuario atribuiu antes', async () => {
    const { service, pedidos } = montar();
    pedidos.procurarPorEmpresa.mockResolvedValue(pedidoPendente);
    pedidos.reatribuir.mockRejectedValue(new PedidoAlteradoError());

    await expect(
      service.atribuir(ID_EMPRESA, ID_PEDIDO, NOVO_CPF),
    ).rejects.toThrow(ConflictException);
  });
});

describe('PedidoService.criar com entregador', () => {
  const pedido = () =>
    ({ cpf_entregador: NOVO_CPF }) as unknown as CriaPedidoReqDto;

  it('exige que o entregador seja da frota da empresa do token', async () => {
    const { service, entregadores, pedidos } = montar();
    entregadores.procurarAtivoPorEmpresa.mockResolvedValue(null);

    await expect(service.criar(ID_EMPRESA, pedido())).rejects.toThrow(
      NotFoundException,
    );
    expect(entregadores.procurarAtivoPorEmpresa).toHaveBeenCalledWith(
      ID_EMPRESA,
      NOVO_CPF,
    );
    expect(pedidos.criar).not.toHaveBeenCalled();
  });

  it('recusa entregador indisponivel', async () => {
    const { service, entregadores, pedidos } = montar();
    entregadores.procurarAtivoPorEmpresa.mockResolvedValue({
      ...novoEntregador,
      disponivel: false,
    });

    await expect(service.criar(ID_EMPRESA, pedido())).rejects.toThrow(
      ConflictException,
    );
    expect(pedidos.criar).not.toHaveBeenCalled();
  });

  it('responde 409 se o entregador foi ocupado durante a gravacao', async () => {
    const { service, pedidos } = montar();
    pedidos.criar.mockRejectedValue(new EntregadorIndisponivelError());

    await expect(service.criar(ID_EMPRESA, pedido())).rejects.toThrow(
      ConflictException,
    );
  });

  it('grava o pedido com a empresa do token', async () => {
    const { service, pedidos } = montar();
    const dto = pedido();

    await service.criar(ID_EMPRESA, dto);

    expect(pedidos.criar).toHaveBeenCalledWith(dto, ID_EMPRESA);
    expect(dto.status).toBe(StatusPedido.EM_ANDAMENTO);
  });
});

describe('PedidoService.listarHistoricoDeEntregadores', () => {
  it('responde 404 quando o pedido nao pertence a empresa', async () => {
    const { service, pedidos } = montar();
    pedidos.procurarPorEmpresa.mockResolvedValue(null);

    await expect(
      service.listarHistoricoDeEntregadores(ID_EMPRESA, ID_PEDIDO),
    ).rejects.toThrow(NotFoundException);
    expect(pedidos.listarHistoricoDeEntregadores).not.toHaveBeenCalled();
  });

  it('devolve so os nomes e a data de cada troca', async () => {
    const { service } = montar();

    await expect(
      service.listarHistoricoDeEntregadores(ID_EMPRESA, ID_PEDIDO),
    ).resolves.toEqual([
      { anterior: null, novo: 'Bruno Lima', data: DATA_CRIACAO },
    ]);
  });
});

describe('PedidoService listagens', () => {
  it('lista os pedidos da empresa no formato resumido', async () => {
    const { service, pedidos } = montar();

    await expect(service.listarDaEmpresa(ID_EMPRESA)).resolves.toEqual([
      {
        id: ID_PEDIDO,
        recebedor: 'Carla Menezes',
        entregador: null,
        status: StatusPedido.PENDENTE,
        criadoEm: DATA_CRIACAO,
        valorEntrega: 1430,
        ganhoConsolidadoCentavos: null,
        distanciaConhecida: null,
        finalizadoEm: null,
        nota: null,
      },
    ]);
    expect(pedidos.listarDaEmpresa).toHaveBeenCalledWith(ID_EMPRESA);
  });

  it.each([
    ['avaliado com nota 4', { avaliacao_entrega: 4 }, 4],
    ['avaliado com nota 0', { avaliacao_entrega: 0 }, 0],
    ['sem avaliacao', null, null],
  ])(
    'mostra o pedido finalizado %s',
    async (_caso, avaliacao, notaEsperada) => {
      const { service, pedidos } = montar();
      const finalizadoEm = new Date('2026-10-07T18:00:00Z');
      pedidos.listarDaEmpresa.mockResolvedValue([
        {
          ...pedidoEmAndamento,
          status: StatusPedido.FINALIZADO,
          data_finalizacao: finalizadoEm,
          entregador: { nome: 'Bruno Lima' },
          avaliacao,
        },
      ]);

      const [pedido] = await service.listarDaEmpresa(ID_EMPRESA);

      expect(pedido).toMatchObject({
        status: StatusPedido.FINALIZADO,
        valorEntrega: 1430,
        ganhoConsolidadoCentavos: null,
        distanciaConhecida: null,
        finalizadoEm,
        nota: notaEsperada,
      });
    },
  );

  it('lista as entregas do entregador com endereco montado e sem telefone', async () => {
    const { service, pedidos } = montar();

    const [entrega] = await service.listarDoEntregador(CPF_ENTREGADOR);

    expect(pedidos.listarDoEntregador).toHaveBeenCalledWith(CPF_ENTREGADOR);
    expect(entrega).toEqual({
      id: ID_PEDIDO,
      status: StatusPedido.EM_ANDAMENTO,
      empresa: 'Cantina Dona Marta',
      recebedor: 'Carla Menezes',
      endereco: 'Rua das Flores, 10 - Centro, Brasilia/DF',
      valorEntrega: 1430,
      ganhoConsolidadoCentavos: null,
      distanciaConhecida: null,
      distancia: 4200,
      criadoEm: DATA_CRIACAO,
      iniciadoEm: DATA_CRIACAO,
      finalizadoEm: null,
    });
  });
});

describe('PedidoService e o rastreio em tempo real', () => {
  it('avisa o rastreio depois de gravar a finalizacao', async () => {
    const { service, pedidos, localizacao } = montar();

    await service.finalizar(CPF_ENTREGADOR, ID_PEDIDO, '482913');

    expect(localizacao.aoMudarStatus).toHaveBeenCalledWith(
      ID_PEDIDO,
      StatusPedido.FINALIZADO,
    );
    expect(pedidos.atualizarStatus.mock.invocationCallOrder[0]).toBeLessThan(
      localizacao.aoMudarStatus.mock.invocationCallOrder[0],
    );
  });

  it('nao avisa o rastreio quando a troca de status e recusada', async () => {
    const { service, localizacao } = montar();

    await expect(
      service.atualizarStatus(CPF_ENTREGADOR, ID_PEDIDO, StatusPedido.PENDENTE),
    ).rejects.toThrow(ConflictException);
    expect(localizacao.aoMudarStatus).not.toHaveBeenCalled();
  });

  it('reinicia a posicao ao trocar o entregador sem mudar o status', async () => {
    const { service, localizacao } = montar();

    await service.reatribuir(ID_EMPRESA, ID_PEDIDO, NOVO_CPF);

    expect(localizacao.aoTrocarEntregador).toHaveBeenCalledWith(ID_PEDIDO);
    expect(localizacao.aoMudarStatus).not.toHaveBeenCalled();
  });

  it('avisa a mudanca de status quando a atribuicao inicia a entrega', async () => {
    const { service, pedidos, localizacao } = montar();
    pedidos.procurarPorEmpresa.mockResolvedValue(pedidoPendente);

    await service.reatribuir(ID_EMPRESA, ID_PEDIDO, NOVO_CPF);

    expect(localizacao.aoMudarStatus).toHaveBeenCalledWith(
      ID_PEDIDO,
      StatusPedido.EM_ANDAMENTO,
    );
  });
});

describe('PedidoService.corrigirDistancia', () => {
  it('falha de localizacao apos commit nao provoca segunda consolidacao', async () => {
    const {
      service: servicoPedidos,
      pedidos: repositorioPedidos,
      localizacao: servicoLocalizacao,
    } = montar();
    servicoLocalizacao.aoMudarStatus.mockRejectedValueOnce(
      new Error('localizacao indisponivel'),
    );
    await expect(
      servicoPedidos.finalizar(CPF_ENTREGADOR, ID_PEDIDO, '482913'),
    ).rejects.toThrow('localizacao indisponivel');
    repositorioPedidos.procurarAtribuidoAoEntregador.mockResolvedValue({
      ...pedidoEmAndamento,
      status: StatusPedido.FINALIZADO,
    });
    await expect(
      servicoPedidos.finalizar(CPF_ENTREGADOR, ID_PEDIDO, '482913'),
    ).rejects.toThrow(ConflictException);
    expect(repositorioPedidos.atualizarStatus).toHaveBeenCalledTimes(1);
  });

  it('nao permite acessar pedido de outra empresa', async () => {
    const { service: servicoPedidos, pedidos: repositorioPedidos } = montar();
    repositorioPedidos.procurarPorEmpresa.mockResolvedValue(null);
    await expect(
      servicoPedidos.corrigirDistancia(ID_EMPRESA, ID_PEDIDO, 0),
    ).rejects.toThrow(NotFoundException);
    expect(repositorioPedidos.procurarPorEmpresa).toHaveBeenCalledWith(
      ID_PEDIDO,
      ID_EMPRESA,
    );
    expect(repositorioPedidos.corrigirDistancia).not.toHaveBeenCalled();
  });

  it.each([StatusPedido.FINALIZADO, StatusPedido.CANCELADO])(
    'bloqueia correcao em %s',
    async (status) => {
      const { service: servicoPedidos, pedidos: repositorioPedidos } = montar();
      repositorioPedidos.procurarPorEmpresa.mockResolvedValue({
        ...pedidoEmAndamento,
        status,
      });
      await expect(
        servicoPedidos.corrigirDistancia(ID_EMPRESA, ID_PEDIDO, 4200),
      ).rejects.toThrow(ConflictException);
      expect(repositorioPedidos.corrigirDistancia).not.toHaveBeenCalled();
    },
  );

  it('permite confirmar distancia zero e preserva identidade da empresa', async () => {
    const { service: servicoPedidos, pedidos: repositorioPedidos } = montar();
    await servicoPedidos.corrigirDistancia(ID_EMPRESA, ID_PEDIDO, 0);
    expect(repositorioPedidos.corrigirDistancia).toHaveBeenCalledWith(
      ID_PEDIDO,
      ID_EMPRESA,
      0,
    );
  });

  it('mapeia corrida com conclusao para conflito', async () => {
    const { service: servicoPedidos, pedidos: repositorioPedidos } = montar();
    repositorioPedidos.corrigirDistancia.mockRejectedValue(
      new PedidoAlteradoError(),
    );
    await expect(
      servicoPedidos.corrigirDistancia(ID_EMPRESA, ID_PEDIDO, 4200),
    ).rejects.toThrow(ConflictException);
  });
});

describe('PedidoService.detalhar', () => {
  const INICIO = new Date('2026-10-07T17:10:00Z');
  const completo = {
    ...pedidoEmAndamento,
    descricao: 'Duas marmitas',
    telefone_recebedor: '61920000001',
    cep: '70000000',
    logradouro: 'SQN 210 Bloco K',
    numero: 304,
    complemento: null,
    bairro: 'Asa Norte',
    cidade: 'Brasilia',
    uf: 'DF',
    valor_entrega: 1250,
    distancia: 4200,
    data_inicio_entrega: INICIO,
    data_finalizacao: null,
    entregador: { nome: 'Bruno Lima' },
  };

  it('devolve recebedor, endereco, entregador e a linha do tempo', async () => {
    const { service, pedidos } = montar();
    pedidos.procurarDetalheDaEmpresa.mockResolvedValue(completo);

    const detalhe = await service.detalhar(ID_EMPRESA, ID_PEDIDO);

    expect(detalhe).toMatchObject({
      id: ID_PEDIDO,
      status: StatusPedido.EM_ANDAMENTO,
      recebedor: { nome: 'Carla Menezes', telefone: '61920000001' },
      endereco: { logradouro: 'SQN 210 Bloco K', numero: 304, uf: 'DF' },
      entregador: 'Bruno Lima',
      valorEntrega: 1250,
      ganhoConsolidadoCentavos: null,
      distanciaConhecida: null,
      linhaDoTempo: [
        { etapa: 'CRIADO', em: DATA_CRIACAO },
        { etapa: StatusPedido.EM_ANDAMENTO, em: INICIO },
      ],
    });
    expect(detalhe).not.toHaveProperty('cpf_entregador');
  });

  it('responde 404 para pedido de outra empresa', async () => {
    const { service } = montar();

    await expect(service.detalhar(ID_EMPRESA, ID_PEDIDO)).rejects.toThrow(
      NotFoundException,
    );
  });
});
