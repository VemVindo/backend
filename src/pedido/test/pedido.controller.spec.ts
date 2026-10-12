import { Test, TestingModule } from '@nestjs/testing';
import { PedidoController } from '../pedido.controller';
import { PedidoService } from '../pedido.service';
import { CriaPedidoReqDto, CriaPedidoResDto } from '../dto/cria-pedido.dto';
import { Pedido } from 'src/generated/prisma/client';

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
      const result = await controller.criar(dummyReq);
      expect(result).toBeInstanceOf(CriaPedidoResDto);
    });
  });
});
