import { Test, TestingModule } from '@nestjs/testing';
import { PedidoService } from '../pedido.service';
import { PedidoDto } from '../dto/pedido.dto';

describe('PedidoService', () => {
  let service: PedidoService;
  let pedido: PedidoDto;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PedidoService, PedidoDto],
    }).compile();

    service = module.get<PedidoService>(PedidoService);
  });

  it('should be defined', () => {
    expect(service.criar()).toBe();
  });
});
