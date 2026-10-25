import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from '../dashboard.controller';
import { DashboardService } from '../dashboard.service';
import { UsuarioAutenticado } from 'src/auth/jwt.strategy';
import { DashboardReqDto, DashboardResDto } from '../dto/dashboard.dto';
import { Cargo } from 'src/common/enums/cargo.enum';

describe('DashboardController', () => {
  let controller: DashboardController;
  let service: DashboardService;

  describe('INFORMACOES', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        controllers: [DashboardController],
        providers: [
          {
            provide: DashboardService,
            useValue: {
              montaDashboard: jest.fn(),
            },
          },
        ],
      }).compile();

      controller = module.get<DashboardController>(DashboardController);
      service = module.get<DashboardService>(DashboardService);
    });

    it('CAIXA CINZA: Fluxo Completo', async () => {
      const dummyUsuario = {
        empresaId: {} as string,
        usuarioId: {} as string,
        cargo: {} as Cargo,
      } as UsuarioAutenticado;

      const dummyReq = {} as DashboardReqDto;
      const dummyRes = {} as Promise<DashboardResDto>;

      jest.spyOn(service, 'montaDashboard').mockImplementation(() => dummyRes);

      const result = await controller.informacoes(dummyUsuario, dummyReq);

      expect(result).toBe(await dummyRes);
    });
  });
});
