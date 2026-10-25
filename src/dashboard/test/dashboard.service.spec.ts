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
      const dummyEmpresaId = 1;
      const dummyReqDto = {} as DashboardReqDto;

      const result = await service.montaDashboard(dummyEmpresaId, dummyReqDto);

      expect(() =>
        repository.definirAtributos(dummyEmpresaId, dummyReqDto),
      ).not.toThrow();
      expect(result.idEmpresa).toBe(dummyEmpresaId);
      expect(typeof result.totalPedidos).toBe('number');
      expect(typeof result.mediaAvaliacoes).toBe('number');
    });

    it('CAIXA BRANCA: Tratamento de valores vazios nas métricas de avaliações e tempo', async () => {
      const dummyEmpresaId = 1;
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
      const dummyEmpresaId = 1;
      const dummyReqDto = {} as DashboardReqDto;

      const result = await service.montaDashboard(dummyEmpresaId, dummyReqDto);

      // Validamos a tipagem e os valores checando propriedade por propriedade de forma estrita
      expect(typeof result.idEmpresa).toBe('number');
      expect(typeof result.totalPedidos).toBe('number');
      expect(typeof result.totalPedidosPendentes).toBe('number');
      expect(typeof result.totalPedidosAndamento).toBe('number');
      expect(typeof result.totalPedidosConcluidos).toBe('number');
      expect(typeof result.totalPedidosCancelados).toBe('number');
      expect(typeof result.mediaAvaliacoes).toBe('number');
      expect(typeof result.tempoMediaEntrega).toBe('number');
      expect(result.totalDistanciaPercorrida).toBeNull();
      expect(result.relatorioPorEntregador).toBeNull();
    });
  });
});
