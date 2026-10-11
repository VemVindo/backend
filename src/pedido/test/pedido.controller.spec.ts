import { Test, TestingModule } from '@nestjs/testing';
import { PedidoController } from '../pedido.controller';
import { PedidoService } from '../pedido.service';

describe('PedidoController', () => {
  let controller: PedidoController;
  const mockUserService = {
    findOne: jest.fn().mockResolvedValue({ id: '123', name: 'Guilherme' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PedidoController],
      providers: [{ provide: PedidoService, useValue: mockUserService }],
    }).compile();

    controller = module.get<PedidoController>(PedidoController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
