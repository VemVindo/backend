import { Test, TestingModule } from '@nestjs/testing';
import { PedidoController } from '../pedido.controller';
import { ConversaDoPedidoService } from '../conversa-do-pedido.service';
import { PedidoService } from '../pedido.service';
import { CriarPedidoDto, PedidoCriadoDto } from '../dto/criar-pedido.dto';
import { Pedido } from '../../generated/prisma/client';
import { StatusPedido } from '../../generated/prisma/enums';
import { Cargo } from '../../common/enums/cargo.enum';
import type { UsuarioAutenticado } from '../../auth/jwt.strategy';

jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: class {},
}));

const EMPRESA: UsuarioAutenticado = {
  usuarioId: '7',
  cargo: Cargo.ESTABELECIMENTO,
  empresaId: '7',
};

describe('PedidoController.criar', () => {
  const dadosDoPedido = {
    nome_recebedor: 'Carla Menezes',
    cidade: 'Brasilia',
  } as CriarPedidoDto;
  const pedidoGravado = {
    id_pedido: 1,
    nome_recebedor: 'Carla Menezes',
    cidade: 'Brasilia',
    status: StatusPedido.PENDENTE,
    idEmpresa: 7,
  } as Pedido;
  let controlador: PedidoController;
  let criar: jest.Mock;

  beforeEach(async () => {
    criar = jest.fn().mockResolvedValue(pedidoGravado);
    const modulo: TestingModule = await Test.createTestingModule({
      controllers: [PedidoController],
      providers: [
        { provide: PedidoService, useValue: { criar } },
        { provide: ConversaDoPedidoService, useValue: {} },
      ],
    }).compile();

    controlador = modulo.get<PedidoController>(PedidoController);
  });

  it('cria com a empresa do token e devolve o pedido como PedidoCriadoDto', async () => {
    const pedidoCriado = await controlador.criar(EMPRESA, dadosDoPedido);

    expect(criar).toHaveBeenCalledWith(7, dadosDoPedido);
    expect(pedidoCriado).toBeInstanceOf(PedidoCriadoDto);
    expect(pedidoCriado).toMatchObject({
      id_pedido: 1,
      nome_recebedor: 'Carla Menezes',
      status: StatusPedido.PENDENTE,
    });
  });
});

describe('PedidoController rotas de entregador e reatribuicao', () => {
  const entregador: UsuarioAutenticado = {
    usuarioId: '52998224725',
    cargo: Cargo.ENTREGADOR,
  };
  function montar() {
    const servico = {
      obterStatusDisponiveis: jest.fn().mockResolvedValue({}),
      atualizarStatus: jest.fn().mockResolvedValue({}),
      reatribuir: jest.fn().mockResolvedValue({}),
      atribuir: jest.fn().mockResolvedValue({}),
      corrigirDistancia: jest.fn().mockResolvedValue({}),
      listarHistoricoDeEntregadores: jest.fn().mockResolvedValue([]),
      listarDaEmpresa: jest.fn().mockResolvedValue([]),
      listarDoEntregador: jest.fn().mockResolvedValue([]),
      detalhar: jest.fn().mockResolvedValue({}),
      finalizar: jest.fn().mockResolvedValue({}),
    };
    const controlador = new PedidoController(
      servico as unknown as PedidoService,
      {} as ConversaDoPedidoService,
    );
    return { controlador, servico };
  }

  it('consulta status disponiveis com o cpf do entregador logado', async () => {
    const { controlador, servico } = montar();

    await controlador.obterStatusDisponiveis(entregador, 1);

    expect(servico.obterStatusDisponiveis).toHaveBeenCalledWith(
      '52998224725',
      1,
    );
  });

  it('corrige distancia usando a empresa do token', async () => {
    const { controlador: controladorPedidos, servico: servicoPedidos } =
      montar();
    await controladorPedidos.corrigirDistancia(EMPRESA, 1, {
      distanciaMetros: 0,
    });
    expect(servicoPedidos.corrigirDistancia).toHaveBeenCalledWith(7, 1, 0);
  });

  it('atualiza status com o cpf do entregador logado', async () => {
    const { controlador, servico } = montar();

    await controlador.atualizarStatus(entregador, 1, {
      status: StatusPedido.FINALIZADO,
    });

    expect(servico.atualizarStatus).toHaveBeenCalledWith(
      '52998224725',
      1,
      StatusPedido.FINALIZADO,
    );
  });

  it('finaliza com o cpf do entregador logado e o codigo do recebedor', async () => {
    const { controlador, servico } = montar();

    await controlador.finalizar(entregador, 1, { codigo: '123456' });

    expect(servico.finalizar).toHaveBeenCalledWith('52998224725', 1, '123456');
  });

  it('reatribui usando a empresa do token, nunca a do corpo', async () => {
    const { controlador, servico } = montar();

    await controlador.reatribuir(EMPRESA, 1, { cpfEntregador: '11144477735' });

    expect(servico.reatribuir).toHaveBeenCalledWith(7, 1, '11144477735');
  });

  it('atribui usando a empresa do token, nunca a do corpo', async () => {
    const { controlador, servico } = montar();

    await controlador.atribuir(EMPRESA, 1, { cpfEntregador: '11144477735' });

    expect(servico.atribuir).toHaveBeenCalledWith(7, 1, '11144477735');
  });

  it('lista o historico usando a empresa do token', async () => {
    const { controlador, servico } = montar();

    await controlador.listarHistoricoDeEntregadores(EMPRESA, 1);

    expect(servico.listarHistoricoDeEntregadores).toHaveBeenCalledWith(7, 1);
  });

  it('lista os pedidos da empresa do token', async () => {
    const { controlador, servico } = montar();

    await controlador.listarDaEmpresa(EMPRESA);

    expect(servico.listarDaEmpresa).toHaveBeenCalledWith(7);
  });

  it('detalha o pedido usando a empresa do token', async () => {
    const { controlador, servico } = montar();

    await controlador.detalhar(EMPRESA, 1);

    expect(servico.detalhar).toHaveBeenCalledWith(7, 1);
  });

  it('lista as entregas do entregador logado', async () => {
    const { controlador, servico } = montar();

    await controlador.listarDoEntregador(entregador);

    expect(servico.listarDoEntregador).toHaveBeenCalledWith('52998224725');
  });
});

describe('PedidoController conversa pelo WhatsApp', () => {
  const entregador: UsuarioAutenticado = {
    usuarioId: '52998224725',
    cargo: Cargo.ENTREGADOR,
  };
  function montar() {
    const servico = {
      conversaComEntregador: jest.fn().mockResolvedValue({}),
      conversaComEstabelecimento: jest.fn().mockResolvedValue({}),
      conversaComRecebedor: jest.fn().mockResolvedValue({}),
    };
    const controlador = new PedidoController(
      {} as PedidoService,
      servico as unknown as ConversaDoPedidoService,
    );
    return { controlador, servico };
  }

  it('a empresa abre a conversa com a empresa do token', async () => {
    const { controlador, servico } = montar();

    await controlador.conversaComEntregador(EMPRESA, 1);

    expect(servico.conversaComEntregador).toHaveBeenCalledWith(7, 1);
  });

  it('o entregador abre a conversa com o cpf do token', async () => {
    const { controlador, servico } = montar();

    await controlador.conversaComEstabelecimento(entregador, 1);

    expect(servico.conversaComEstabelecimento).toHaveBeenCalledWith(
      '52998224725',
      1,
    );
  });

  it('a empresa abre a conversa com o recebedor usando a empresa do token', async () => {
    const { controlador, servico } = montar();

    await controlador.conversaComRecebedor(EMPRESA, 1);

    expect(servico.conversaComRecebedor).toHaveBeenCalledWith(7, 1);
  });
});
