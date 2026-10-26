import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import type { UsuarioAutenticado } from '../../auth/jwt.strategy';
import { Cargo } from '../../common/enums/cargo.enum';
import { DashboardController } from '../dashboard.controller';
import { DashboardService } from '../dashboard.service';
import { FiltroDashboardDto } from '../dto/filtro-dashboard.dto';

jest.mock('../../prisma/prisma.service', () => ({ PrismaService: class {} }));

const EMPRESA: UsuarioAutenticado = {
  usuarioId: '7',
  cargo: Cargo.ESTABELECIMENTO,
  empresaId: '7',
};

describe('DashboardController', () => {
  it('monta o dashboard da empresa do token com o periodo da query', async () => {
    const dashboardService = {
      montarDashboard: jest.fn().mockResolvedValue({ idEmpresa: 7 }),
    };
    const controlador = new DashboardController(
      dashboardService as unknown as DashboardService,
    );
    const periodo = { dataInicio: new Date('2026-10-01T00:00:00Z') };

    await expect(controlador.consultar(EMPRESA, periodo)).resolves.toEqual({
      idEmpresa: 7,
    });
    expect(dashboardService.montarDashboard).toHaveBeenCalledWith(7, periodo);
  });
});

describe('FiltroDashboardDto', () => {
  const converter = (query: object) =>
    plainToInstance(FiltroDashboardDto, query);
  const camposInvalidos = (query: object) =>
    validateSync(converter(query)).map((erro) => erro.property);

  it('aceita a consulta sem periodo', () => {
    expect(camposInvalidos({})).toEqual([]);
  });

  it('converte as datas da query string', () => {
    const filtro = converter({
      dataInicio: '2026-10-01T00:00:00Z',
      dataFinal: '2026-10-31T23:59:59Z',
    });

    expect(validateSync(filtro)).toEqual([]);
    expect(filtro.dataInicio).toEqual(new Date('2026-10-01T00:00:00Z'));
    expect(filtro.dataFinal).toEqual(new Date('2026-10-31T23:59:59Z'));
  });

  it('recusa data invalida e valor que nao e texto', () => {
    expect(
      camposInvalidos({ dataInicio: 'ontem', dataFinal: 20261031 }).sort(),
    ).toEqual(['dataFinal', 'dataInicio']);
  });
});
