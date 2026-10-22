import { Test, TestingModule } from '@nestjs/testing';
import { RemuneracaoFactory } from '../factories/remuneracao.factory';
import { RemuneracaoRepository } from '../remuneracao.repository';
import { RemuneracaoInexistente } from '../strategies/remuneracao-inexistente.strategy';
import { RemuneracaoExistente } from '../strategies/remuneracao-existente.strategy';
import { PrismaService } from '../../prisma/prisma.service';

describe('RemuneracaoFactory', () => {
  let remuneracaoFactory: RemuneracaoFactory;
  const dummyReq = {
    idEmpresa: {} as number,
    taxa_fixa: {} as number,
    coeficiente: {} as number,
  };

  describe('criar', () => {
    let mock: jest.Mock;
    beforeEach(async () => {
      mock = jest.fn();
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          RemuneracaoFactory,
          PrismaService,
          {
            provide: RemuneracaoRepository,
            useValue: {
              verificaRemuneracao: mock,
            },
          },
        ],
      }).compile();

      remuneracaoFactory = module.get<RemuneracaoFactory>(RemuneracaoFactory);
    });

    it('Caixa Cinza: Verificacao Falha', async () => {
      mock.mockResolvedValue(null);
      const result = await remuneracaoFactory.criar(
        dummyReq.idEmpresa,
        dummyReq.taxa_fixa,
        dummyReq.coeficiente,
      );
      expect(result).toBeInstanceOf(RemuneracaoInexistente);
    });

    it('Caixa Cinza: Verificacao bem sucedida', async () => {
      const dummyRes = {
        data: {
          toISOString: jest.fn(),
        },
      };
      mock.mockResolvedValue(dummyRes);
      const result = await remuneracaoFactory.criar(
        dummyReq.idEmpresa,
        dummyReq.taxa_fixa,
        dummyReq.coeficiente,
      );
      expect(result).toBeInstanceOf(RemuneracaoExistente);
    });
  });
});
