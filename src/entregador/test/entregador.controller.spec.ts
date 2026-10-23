import { Test, TestingModule } from '@nestjs/testing';
import { EntregadorController } from '../entregador.controller';
import { EntregadorService } from '../entregador.service';
import { UsuarioAutenticado } from 'src/auth/jwt.strategy';
import { EditarEntregadorReqDto } from '../dto/editar-entregador.dto';
import { Cargo } from 'src/common/enums/cargo.enum';

describe('EntregadorController', () => {
  let controller: EntregadorController;
  let service: EntregadorService;
  describe('Editar', () => {
    let mock: jest.Mock;
    const dummyUser = {
      usuarioId: {} as string,
      empresaId: {} as string,
      cargo: {} as Cargo,
    } as UsuarioAutenticado;
    beforeEach(async () => {
      mock = jest.fn();
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: EntregadorService,
            useValue: {
              editar: mock,
            },
          },
        ],
        controllers: [EntregadorController],
      }).compile();

      controller = module.get<EntregadorController>(EntregadorController);
      service = module.get<EntregadorService>(EntregadorService);
    });

    it('CAIXA CINZA: Fluxo completo bem sucedido', async () => {
      mock.mockResolvedValue(true);
      const dummyDto = {} as EditarEntregadorReqDto;
      const spy = jest.spyOn(service, 'editar');
      const result = await controller.editar(dummyUser, dummyDto);
      expect(result).toBe(true);
      expect(spy).toHaveBeenCalledWith(Number(dummyUser.empresaId), dummyDto);
    });

    it('CAIXA CINZA: Fluxo completo bem sucedido', async () => {
      mock.mockResolvedValue(false);
      const dummyDto = {} as EditarEntregadorReqDto;
      const spy = jest.spyOn(service, 'editar');
      const result = await controller.editar(dummyUser, dummyDto);
      expect(result).toBe(false);
      expect(spy).toHaveBeenCalledWith(Number(dummyUser.empresaId), dummyDto);
    });
  });
});
