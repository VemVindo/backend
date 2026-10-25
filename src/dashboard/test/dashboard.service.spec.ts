import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from '../dashboard.service';
import { DashboardRepository } from '../dashboard.repository';
import { DashboardReqDto } from '../dto/dashboard.dto';
import { StatusPedido } from '../../generated/prisma/enums';

describe('DashboardService', () => {
  let service: DashboardService;
  let repository: DashboardRepository;
  const dummyIdEmpresa = 1 as number;
  const dummyTotalPedidos = [] as any[];
  const dummyTotalPedidosPendentes = [] as any[];
  const dummyTotalPedidosAndamento = [] as any[];
  const dummyTotalPedidosConcluidos = [] as any[];
  const dummyTotalPedidosCancelados = [] as any[];
  const dummyMediaAvaliacoes = [{ avaliacao_entrega: 5 }] as {
    avaliacao_entrega: number;
  }[];
  const dummyTempoMedioEntrega = [
    {
      data_inicio_entrega: new Date(),
      data_finalizacao: new Date(),
    },
  ];
  const dummyTotalDistanciaPercorrida = [{ distancia: 10 }] as {
    distancia: number;
  }[];
  const dummyRelatorioPorEntregador = [
    {
      cpf: '12345678901',
      nome: 'Entregador Teste',
      pedidos: [
        {
          status: StatusPedido.FINALIZADO,
          valor_entrega: 15.0,
          data_inicio_entrega: new Date(),
          data_finalizacao: new Date(),
        },
      ],
    },
  ] as any[];

  describe('MONTADASHBOARD', () => {
    let mockDefinirAtributos: jest.Mock;
    let mockTotalPedidos: jest.Mock;
    let mockTotalPedidosPendentes: jest.Mock;
    let mockTotalPedidosAndamento: jest.Mock;
    let mockTotalPedidosConcluidos: jest.Mock;
    let mockTotalPedidosCancelados: jest.Mock;
    let mockAvaliacoes: jest.Mock;
    let mockTempoMedioEntrega: jest.Mock;
    let mockTotalDistanciaPercorrida: jest.Mock;
    let mockRelatorioPorEntregador: jest.Mock;

    beforeEach(async () => {
      mockDefinirAtributos = jest.fn();
      mockTotalPedidos = jest.fn().mockResolvedValue(dummyTotalPedidos);
      mockTotalPedidosPendentes = jest
        .fn()
        .mockResolvedValue(dummyTotalPedidosPendentes);
      mockTotalPedidosAndamento = jest
        .fn()
        .mockResolvedValue(dummyTotalPedidosAndamento);
      mockTotalPedidosConcluidos = jest
        .fn()
        .mockResolvedValue(dummyTotalPedidosConcluidos);
      mockTotalPedidosCancelados = jest
        .fn()
        .mockResolvedValue(dummyTotalPedidosCancelados);
      mockAvaliacoes = jest.fn().mockResolvedValue(dummyMediaAvaliacoes);
      mockTempoMedioEntrega = jest
        .fn()
        .mockResolvedValue(dummyTempoMedioEntrega);
      mockTotalDistanciaPercorrida = jest
        .fn()
        .mockResolvedValue(dummyTotalDistanciaPercorrida);
      mockRelatorioPorEntregador = jest
        .fn()
        .mockResolvedValue(dummyRelatorioPorEntregador);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          DashboardService,
          {
            provide: DashboardRepository,
            useValue: {
              definirAtributos: mockDefinirAtributos,
              totalPedidos: mockTotalPedidos,
              totalPedidosPendentes: mockTotalPedidosPendentes,
              totalPedidosAndamento: mockTotalPedidosAndamento,
              totalPedidosConcluidos: mockTotalPedidosConcluidos,
              totalPedidosCancelados: mockTotalPedidosCancelados,
              avaliacoes: mockAvaliacoes,
              tempoMedioEntrega: mockTempoMedioEntrega,
              totalDistanciaPercorrida: mockTotalDistanciaPercorrida,
              relatorioPorEntregador: mockRelatorioPorEntregador,
            },
          },
        ],
      }).compile();

      service = module.get<DashboardService>(DashboardService);
      repository = module.get<DashboardRepository>(DashboardRepository);
    });

    it('CAIXA CINZA: Fluxo Completo de montagem do dashboard', async () => {
      const dummyReqDto = {} as DashboardReqDto;

      const result = await service.montaDashboard(dummyIdEmpresa, dummyReqDto);

      expect(result).not.toBeNull();
      expect(result).not.toBeUndefined();
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
      expect(typeof result.totalDistanciaPercorrida).toBe('number');
      expect(Array.isArray(result.relatorioPorEntregador)).toBe(true);
    });
  });
});
