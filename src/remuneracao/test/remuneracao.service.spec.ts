import { Test, TestingModule } from '@nestjs/testing';
import { RemuneracaoService } from '../remuneracao.service';
import { RemuneracaoFactory } from '../factories/remuneracao.factory';
import { ConfigurarRemuneracaoReqDto } from '../dto/configurar-remuneracao.dto';
import { MetricasPagamento } from 'src/generated/prisma';

describe('RemuneracaoService', () => {
  let service: RemuneracaoService;

  describe('configurarRemuneracao', () => {
    interface Mock {
      configurar: jest.Mock;
    }

    let mockStrategy: Mock;

    beforeEach(async () => {
      mockStrategy = {
        configurar: jest.fn(),
      };
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          RemuneracaoService,
          {
            provide: RemuneracaoFactory,
            useValue: {
              criar: jest.fn().mockReturnValue(mockStrategy),
            },
          },
        ],
      }).compile();

      service = module.get<RemuneracaoService>(RemuneracaoService);

      jest.clearAllMocks();
    });

    it('CAIXA CINZA: Fluxo completo com erro na configuração', async () => {
      mockStrategy.configurar.mockResolvedValue(null);
      const dummyIdEmpresa = {} as number;
      const dummyDto: ConfigurarRemuneracaoReqDto = {
        taxa_fixa: {} as number,
        coeficiente: {} as number,
      };
      const result = await service.configurarRemuneracao(
        dummyIdEmpresa,
        dummyDto,
      );

      expect(result).toBe(false);
    });

    it('CAIXA CINZA: Fluxo completo com configuração bem sucedida', async () => {
      const dummyRes = {} as MetricasPagamento;
      mockStrategy.configurar.mockResolvedValue(dummyRes);
      const dummyIdEmpresa = {} as number;
      const dummyDto: ConfigurarRemuneracaoReqDto = {
        taxa_fixa: {} as number,
        coeficiente: {} as number,
      };

      const result = await service.configurarRemuneracao(
        dummyIdEmpresa,
        dummyDto,
      );

      expect(result).toBe(true);
    });
  });
});
