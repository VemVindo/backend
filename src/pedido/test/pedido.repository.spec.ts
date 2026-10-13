import { Test, TestingModule } from '@nestjs/testing';
import { PedidoRepository } from '../pedido.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { Pedido } from '../../generated/prisma/client';
import { CriaPedidoReqDto } from '../dto/cria-pedido.dto';

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
      const dummyRes = {} as Promise<Pedido>;
      jest.spyOn(prisma.pedido, 'create').mockImplementation(() => dummyRes);
      const result = service.criar(dummyReq);
      expect(result).toBeInstanceOf(Promise<Pedido>);
    });
  });
});
