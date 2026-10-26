import type { UsuarioAutenticado } from '../auth/jwt.strategy';
import { Cargo } from '../common/enums/cargo.enum';
import { VinculoController } from './vinculo.controller';
import { VinculoService } from './vinculo.service';

jest.mock('./vinculo.service', () => ({ VinculoService: class {} }));

const ENTREGADOR: UsuarioAutenticado = {
  usuarioId: '52998224725',
  cargo: Cargo.ENTREGADOR,
};

function montar() {
  const vinculoService = {
    dadosCompartilhados: jest.fn().mockResolvedValue({ nome: 'Fulano' }),
    listar: jest.fn().mockResolvedValue([]),
    aceitar: jest.fn().mockResolvedValue(undefined),
    recusar: jest.fn().mockResolvedValue(undefined),
    encerrar: jest.fn().mockResolvedValue(undefined),
  };
  return {
    controlador: new VinculoController(
      vinculoService as unknown as VinculoService,
    ),
    vinculoService,
  };
}

describe('VinculoController', () => {
  it('mostra so os dados do entregador logado', async () => {
    const { controlador, vinculoService } = montar();

    await expect(controlador.dadosCompartilhados(ENTREGADOR)).resolves.toEqual({
      nome: 'Fulano',
    });
    await expect(controlador.listar(ENTREGADOR)).resolves.toEqual([]);
    expect(vinculoService.dadosCompartilhados).toHaveBeenCalledWith(
      '52998224725',
    );
    expect(vinculoService.listar).toHaveBeenCalledWith('52998224725');
  });

  it.each(['aceitar', 'recusar', 'encerrar'] as const)(
    '%s repassa o contrato e o CPF do token',
    async (acao) => {
      const { controlador, vinculoService } = montar();

      await controlador[acao](ENTREGADOR, 15);

      expect(vinculoService[acao]).toHaveBeenCalledWith(15, '52998224725');
    },
  );
});
