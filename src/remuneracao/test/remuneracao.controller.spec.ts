import { Test, TestingModule } from '@nestjs/testing';
import { RemuneracaoController } from '../remuneracao.controller';
import { RemuneracaoService } from '../remuneracao.service';
import { ConfigurarRemuneracaoReqDto } from '../dto/configurar-remuneracao.dto';
import { UsuarioAutenticado } from '../../auth/jwt.strategy';
import { Cargo } from '../../common/enums/cargo.enum';

describe('RemuneracaoController', () => {
  let controller: RemuneracaoController;
  let service: RemuneracaoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: RemuneracaoService,
          useValue: {
            configurarRemuneracao: jest.fn(),
          },
        },
      ],
      controllers: [RemuneracaoController],
    }).compile();
    controller = module.get<RemuneracaoController>(RemuneracaoController);
    service = module.get<RemuneracaoService>(RemuneracaoService);
  });

  it('CAIXA CINZA: Fluxo Completo', () => {
    const usuarioAutenticadoDummy: UsuarioAutenticado = {
      usuarioId: {} as string,
      cargo: {} as Cargo,
      empresaId: {} as string,
    };
    const dtoDummy = {} as ConfigurarRemuneracaoReqDto;
    const dummyRes = {} as Promise<boolean>;
    const spy = jest
      .spyOn(service, 'configurarRemuneracao')
      .mockImplementation(() => dummyRes);
    const result = controller.configurarRemuneracao(
      usuarioAutenticadoDummy,
      dtoDummy,
    );
    expect(spy).toHaveBeenCalledWith(
      Number(usuarioAutenticadoDummy.empresaId),
      dtoDummy,
    );
    expect(result).toBeInstanceOf(Promise<boolean>);
  });
});
