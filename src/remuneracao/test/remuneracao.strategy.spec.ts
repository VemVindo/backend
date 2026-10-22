import { PrismaService } from '../../prisma/prisma.service';
import { Remuneracao } from '../strategies/remuneracao.strategy';
import { RemuneracaoExistente } from '../strategies/remuneracao-existente.strategy';
import { Test, TestingModule } from '@nestjs/testing';
import { MetricasPagamento } from '../../generated/prisma';
import { RemuneracaoInexistente } from '../strategies/remuneracao-inexistente.strategy';

describe('Remuneracao', () => {
  let remuneracao: Remuneracao;
  let prisma: PrismaService;
  describe('Existente', () => {
    let mock: jest.Mock;
    beforeEach(async () => {
      mock = jest.fn();

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: PrismaService,
            useValue: {
              metricasPagamento: {
                update: mock,
              },
            },
          },
        ],
      }).compile();
      prisma = module.get<PrismaService>(PrismaService);

      const stubData = {
        idEmpresa: {} as number,
        prisma,
        taxa_fixa: {} as number,
        coeficiente: {} as number,
        data: {} as string,
      };

      remuneracao = new RemuneracaoExistente(
        stubData.idEmpresa,
        stubData.prisma,
        stubData.taxa_fixa,
        stubData.coeficiente,
        stubData.data,
      );
    });
    it('CAIXA CINZA: Atualizacao mal sucedida', async () => {
      mock.mockResolvedValue(null);
      const result = await remuneracao.configurar();
      expect(result).toBeNull();
    });

    it('CAIXA CINZA: Atualizacao bem sucedida', () => {
      const dummyRes = {} as MetricasPagamento;
      mock.mockResolvedValue(dummyRes);
      const result = remuneracao.configurar();
      expect(result).toBeInstanceOf(Promise<MetricasPagamento>);
    });
  });
  describe('Inexistente', () => {
    let mock: jest.Mock;
    beforeEach(async () => {
      mock = jest.fn();

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: PrismaService,
            useValue: {
              metricasPagamento: {
                create: mock,
              },
            },
          },
        ],
      }).compile();
      prisma = module.get<PrismaService>(PrismaService);

      const stubData = {
        idEmpresa: {} as number,
        prisma,
        taxa_fixa: {} as number,
        coeficiente: {} as number,
      };

      remuneracao = new RemuneracaoInexistente(
        stubData.idEmpresa,
        stubData.prisma,
        stubData.taxa_fixa,
        stubData.coeficiente,
      );
    });
    it('CAIXA CINZA: Criacao mal sucedida', async () => {
      mock.mockResolvedValue(null);
      const result = await remuneracao.configurar();
      expect(result).toBeNull();
    });

    it('CAIXA CINZA: Criacao bem sucedida', () => {
      const dummyRes = {} as MetricasPagamento;
      mock.mockResolvedValue(dummyRes);
      const result = remuneracao.configurar();
      expect(result).toBeInstanceOf(Promise<MetricasPagamento>);
    });
  });
});
