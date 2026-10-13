import { Test, TestingModule } from '@nestjs/testing';
import { PedidoService } from '../pedido.service';
import { PedidoRepository } from '../pedido.repository';
import { EntregadorRepository } from '../../entregador/entregador.repository';
import { CriaPedidoReqDto } from '../dto/cria-pedido.dto';
import { Pedido } from '../../generated/prisma/client';

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
          { provide: EntregadorRepository, useValue: {} },
        ],
      }).compile();
      service = module.get<PedidoService>(PedidoService);
      repository = module.get<PedidoRepository>(PedidoRepository);
    });

    it('CAIXA BRANCA: Entregador sem CPF', async () => {
      const dummy = {} as CriaPedidoReqDto;
      const spy = jest.spyOn(repository, 'criar');
      await service.criar(dummy);
      expect(spy.mock.calls[0][0].status).toBe('Pendente');
      expect(spy.mock.calls[0][0].cpf_entregador).toBeUndefined();
    });

    it('CAIXA BRANCA: Entregador com CPF', async () => {
      const stub = {
        cpf_entregador: 'teste',
      };
      const spy = jest.spyOn(repository, 'criar');
      await service.criar(stub as CriaPedidoReqDto);
      expect(spy.mock.calls[0][0].status).toBe('Em andamento');
      expect(spy.mock.calls[0][0].cpf_entregador).not.toBeUndefined();
    });

    it('CAIXA BRANCA: Data Criacao', async () => {
      const stub = {
        cpf_entregador: 'teste',
      };
      const spy = jest.spyOn(repository, 'criar');
      await service.criar(stub as CriaPedidoReqDto);
      expect(spy.mock.calls[0][0].data_criacao).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/, //Formato ISOString pra datas
      );
    });

    it('CAIXA CINZA: Fluxo Completo', () => {
      const dummyReq = {} as CriaPedidoReqDto;
      const dummyRes = {} as Promise<Pedido>;
      const spy = jest
        .spyOn(repository, 'criar')
        .mockImplementation(() => dummyRes);
      const result = service.criar(dummyReq);
      expect(spy).toHaveBeenCalledWith(dummyReq);
      expect(result).toBeInstanceOf(Promise<Pedido>);
    });
  });
});
