import { Test, TestingModule } from '@nestjs/testing';
import { DashboardRepository } from '../dashboard.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { DashboardReqDto } from '../dto/dashboard.dto';

describe('DashboardRepository', () => {
  let repository: DashboardRepository;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardRepository,
        {
          provide: PrismaService,
          useValue: {
            pedido: {
              findMany: jest.fn().mockResolvedValue([]),
            },
            avaliacao: {
              findMany: jest.fn().mockResolvedValue([]),
            },
            entregador: {
              findMany: jest.fn().mockResolvedValue([]),
            },
          },
        },
      ],
    }).compile();

    repository = module.get<DashboardRepository>(DashboardRepository);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('DEFINIR ATRIBUTOS', () => {
    it('CAIXA BRANCA: Atribuição correta de estado interno da classe', () => {
      const dummyEmpresaId = {} as number;
      const dummyDto = {
        dataInicio: '2026-01-01',
        dataFinal: '2026-01-31',
      } as DashboardReqDto;

      repository.definirAtributos(dummyEmpresaId, dummyDto);

      expect(repository.idEmpresa).toBe(dummyEmpresaId);
      expect(repository.dataInicio).toBe(dummyDto.dataInicio);
      expect(repository.dataFinal).toBe(dummyDto.dataFinal);
    });
  });

  describe('TOTAL PEDIDOS', () => {
    it('CAIXA CINZA: Execução de busca no Prisma com filtros aplicados', async () => {
      const dummyEmpresaId = {} as number;
      const dummyDto = {} as DashboardReqDto;
      repository.definirAtributos(dummyEmpresaId, dummyDto);

      const spyFindMany = jest.spyOn(prisma.pedido, 'findMany');

      const result = await repository.totalPedidos();

      expect(spyFindMany).toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe('RELATORIO POR ENTREGADOR', () => {
    it('CAIXA PRETA: Contrato de retorno da listagem de entregadores', async () => {
      const dummyEmpresaId = {} as number;
      const dummyDto = {} as DashboardReqDto;
      repository.definirAtributos(dummyEmpresaId, dummyDto);

      const result = await repository.relatorioPorEntregador();

      expect(Array.isArray(result)).toBe(true);
    });
  });
});