import { Test, TestingModule } from '@nestjs/testing';
import { RemuneracaoRepository } from '../remuneracao.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { MetricasPagamento } from 'src/generated/prisma';

describe('RemuneracaoRepository', () => {
  let repository: RemuneracaoRepository;

  describe('verificaRemuneracao', () => {
    let mock: jest.Mock;
    const dummyIdEmpresa = {} as number;

    beforeEach(async () => {
      mock = jest.fn();

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          RemuneracaoRepository,
          {
            provide: PrismaService,
            useValue: {
              metricasPagamento: {
                findFirst: mock,
              },
            },
          },
        ],
      }).compile();

      repository = module.get<RemuneracaoRepository>(RemuneracaoRepository);
    });

    it('Caixa Cinza: Verificacao falha', async () => {
      mock.mockResolvedValue(null);
      const result = await repository.verificaRemuneracao(dummyIdEmpresa);
      expect(result).toBe(null);
    });

    it('Caixa Cinza: Verificacao bem sucedida', () => {
      const dummyRes = {} as MetricasPagamento;
      mock.mockResolvedValue(dummyRes);
      const result = repository.verificaRemuneracao(dummyIdEmpresa);
      expect(result).toBeInstanceOf(Promise<MetricasPagamento>);
    });
  });
});
