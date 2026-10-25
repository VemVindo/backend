import { Test, TestingModule } from '@nestjs/testing';
import { PedidoController } from '../pedido.controller';
import { PedidoService } from '../pedido.service';
import { CriaPedidoReqDto, CriaPedidoResDto } from '../dto/cria-pedido.dto';
import { Pedido } from '../../generated/prisma/client';
// import { StatusPedido } from '../../generated/prisma/enums';
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

describe('PedidoController', () => {
  let controller: PedidoController;
  let service: PedidoService;

  describe('CRIAR', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        controllers: [PedidoController],
        providers: [
          {
            provide: PedidoService,
            useValue: {
              criar: jest.fn(),
            },
          },
        ],
      }).compile();

      controller = module.get<PedidoController>(PedidoController);
      service = module.get<PedidoService>(PedidoService);
    });

    it('CAIXA CINZA: Fluxo Completo', async () => {
      const dummyReq = {} as CriaPedidoReqDto;
      const dummyRes = {} as Promise<Pedido>;
      jest.spyOn(service, 'criar').mockImplementation(() => dummyRes);
      const result = await controller.criar(EMPRESA, dummyReq);
      expect(result).toBeInstanceOf(CriaPedidoResDto);
    });
  });
});

// describe('PedidoController rotas de entregador e reatribuicao', () => {
//   const entregador: UsuarioAutenticado = {
//     usuarioId: '52998224725',
//     cargo: Cargo.ENTREGADOR,
//   };
//   function montar() {
//     const service = {
//       obterStatusDisponiveis: jest.fn().mockResolvedValue({}),
//       atualizarStatus: jest.fn().mockResolvedValue({}),
//       reatribuir: jest.fn().mockResolvedValue({}),
//       atribuir: jest.fn().mockResolvedValue({}),
//       corrigirDistancia: jest.fn().mockResolvedValue({}),
//       listarHistoricoDeEntregadores: jest.fn().mockResolvedValue([]),
//       listarDaEmpresa: jest.fn().mockResolvedValue([]),
//       listarDoEntregador: jest.fn().mockResolvedValue([]),
//       detalhar: jest.fn().mockResolvedValue({}),
//     };
//     const controller = new PedidoController(
//       service as unknown as PedidoService,
//     );
//     return { controller, service };
//   }

//   it('consulta status disponiveis com o cpf do entregador logado', async () => {
//     const { controller, service } = montar();

//     await controller.obterStatusDisponiveis(entregador, 1);

//     expect(service.obterStatusDisponiveis).toHaveBeenCalledWith(
//       '52998224725',
//       1,
//     );
//   });

//   it('corrige distancia usando a empresa do token', async () => {
//     const { controller: controladorPedidos, service: servicoPedidos } =
//       montar();
//     await controladorPedidos.corrigirDistancia(EMPRESA, 1, {
//       distanciaMetros: 0,
//     });
//     expect(servicoPedidos.corrigirDistancia).toHaveBeenCalledWith(7, 1, 0);
//   });

//   it('atualiza status com o cpf do entregador logado', async () => {
//     const { controller, service } = montar();

//     await controller.atualizarStatus(entregador, 1, {
//       status: StatusPedido.FINALIZADO,
//     });

//     expect(service.atualizarStatus).toHaveBeenCalledWith(
//       '52998224725',
//       1,
//       StatusPedido.FINALIZADO,
//     );
//   });

//   it('reatribui usando a empresa do token, nunca a do corpo', async () => {
//     const { controller, service } = montar();

//     await controller.reatribuir(EMPRESA, 1, { cpfEntregador: '11144477735' });

//     expect(service.reatribuir).toHaveBeenCalledWith(7, 1, '11144477735');
//   });

//   it('atribui usando a empresa do token, nunca a do corpo', async () => {
//     const { controller, service } = montar();

//     await controller.atribuir(EMPRESA, 1, { cpfEntregador: '11144477735' });

//     expect(service.atribuir).toHaveBeenCalledWith(7, 1, '11144477735');
//   });

//   it('lista o historico usando a empresa do token', async () => {
//     const { controller, service } = montar();

//     await controller.listarHistoricoDeEntregadores(EMPRESA, 1);

//     expect(service.listarHistoricoDeEntregadores).toHaveBeenCalledWith(7, 1);
//   });

//   it('lista os pedidos da empresa do token', async () => {
//     const { controller, service } = montar();

//     await controller.listarDaEmpresa(EMPRESA);

//     expect(service.listarDaEmpresa).toHaveBeenCalledWith(7);
//   });

//   it('detalha o pedido usando a empresa do token', async () => {
//     const { controller, service } = montar();

//     await controller.detalhar(EMPRESA, 1);

//     expect(service.detalhar).toHaveBeenCalledWith(7, 1);
//   });

//   it('lista as entregas do entregador logado', async () => {
//     const { controller, service } = montar();

//     await controller.listarDoEntregador(entregador);

//     expect(service.listarDoEntregador).toHaveBeenCalledWith('52998224725');
//   });
// });

// describe('PedidoController conversa pelo WhatsApp', () => {
//   const entregador: UsuarioAutenticado = {
//     usuarioId: '52998224725',
//     cargo: Cargo.ENTREGADOR,
//   };
//   function montar() {
//     const service = {
//       conversaComEntregador: jest.fn().mockResolvedValue({}),
//       conversaComEstabelecimento: jest.fn().mockResolvedValue({}),
//       conversaComRecebedor: jest.fn().mockResolvedValue({}),
//     };
//     const controller = new PedidoController(
//       service as unknown as PedidoService,
//     );
//     return { controller, service };
//   }

//   it('a empresa abre a conversa com a empresa do token', async () => {
//     const { controller, service } = montar();

//     await controller.conversaComEntregador(EMPRESA, 1);

//     expect(service.conversaComEntregador).toHaveBeenCalledWith(7, 1);
//   });

//   it('o entregador abre a conversa com o cpf do token', async () => {
//     const { controller, service } = montar();

//     await controller.conversaComEstabelecimento(entregador, 1);

//     expect(service.conversaComEstabelecimento).toHaveBeenCalledWith(
//       '52998224725',
//       1,
//     );
//   });

//   it('a empresa abre a conversa com o recebedor usando a empresa do token', async () => {
//     const { controller, service } = montar();

//     await controller.conversaComRecebedor(EMPRESA, 1);

//     expect(service.conversaComRecebedor).toHaveBeenCalledWith(7, 1);
//   });
// });
