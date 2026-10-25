import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from '../dashboard.service';
import { DashboardRepository } from '../dashboard.repository';
import { DashboardReqDto } from '../dto/dashboard.dto';

describe('DashboardService', () => {
  let service: DashboardService;
  let repository: DashboardRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: DashboardRepository,
          useValue: {
            definirAtributos: jest.fn(),
            totalPedidos: jest.fn().mockResolvedValue([]),
            totalPedidosPendentes: jest.fn().mockResolvedValue([]),
            totalPedidosAndamento: jest.fn().mockResolvedValue([]),
            totalPedidosConcluidos: jest.fn().mockResolvedValue([]),
            totalPedidosCancelados: jest.fn().mockResolvedValue([]),
            avaliacoes: jest.fn().mockResolvedValue([]),
            tempoMedioEntrega: jest.fn().mockResolvedValue([]),
            totalDistanciaPercorrida: jest.fn().mockResolvedValue([]),
            relatorioPorEntregador: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    repository = module.get<DashboardRepository>(DashboardRepository);
  });

  describe('MONTADASHBOARD', () => {
    it('CAIXA CINZA: Fluxo Completo de montagem do dashboard', async () => {
      const dummyEmpresaId = {} as number;
      const dummyReqDto = {} as DashboardReqDto;

      const result = await service.montaDashboard(dummyEmpresaId, dummyReqDto);

      expect(repository.definirAtributos).toHaveBeenCalledWith(
        dummyEmpresaId,
        dummyReqDto,
      );
      expect(result).toHaveProperty('idEmpresa', dummyEmpresaId);
      expect(result).toHaveProperty('totalPedidos');
      expect(result).toHaveProperty('mediaAvaliacoes');
    });

    it('CAIXA BRANCA: Tratamento de valores vazios nas métricas de avaliações e tempo', async () => {
      const dummyEmpresaId = {} as number;
      const dummyReqDto = {} as DashboardReqDto;

      jest.spyOn(repository, 'avaliacoes').mockResolvedValue([]);
      jest.spyOn(repository, 'tempoMedioEntrega').mockResolvedValue([]);
      jest.spyOn(repository, 'totalDistanciaPercorrida').mockResolvedValue([]);
      jest.spyOn(repository, 'relatorioPorEntregador').mockResolvedValue([]);

      const result = await service.montaDashboard(dummyEmpresaId, dummyReqDto);

      expect(result.mediaAvaliacoes).toBe(0);
      expect(result.tempoMediaEntrega).toBe(0);
      expect(result.totalDistanciaPercorrida).toBeNull();
      expect(result.relatorioPorEntregador).toBeNull();
    });

    it('CAIXA PRETA: Contrato de retorno da estrutura do DashboardResDto', async () => {
      const dummyEmpresaId = 1 as unknown as number; // ou use number se preferir, mas mantendo o cast
      const dummyReqDto = {} as DashboardReqDto;

      const result = await service.montaDashboard(dummyEmpresaId, dummyReqDto);

      expect(result).toEqual({
        idEmpresa: expect.any(Number),
        totalPedidos: expect.any(Number),
        totalPedidosPendentes: expect.any(Number),
        totalPedidosAndamento: expect.any(Number),
        totalPedidosConcluidos: expect.any(Number),
        totalPedidosCancelados: expect.any(Number),
        mediaAvaliacoes: expect.any(Number),
        tempoMediaEntrega: expect.any(Number),
        totalDistanciaPercorrida: null,
        relatorioPorEntregador: null,
      });
    });
  });
});
