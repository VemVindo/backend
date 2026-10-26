import type { UsuarioAutenticado } from '../auth/jwt.strategy';
import { Cargo } from '../common/enums/cargo.enum';
import { RemuneracaoController } from './remuneracao.controller';
import { RemuneracaoService } from './remuneracao.service';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

const EMPRESA: UsuarioAutenticado = {
  usuarioId: '3',
  cargo: Cargo.ESTABELECIMENTO,
  empresaId: '3',
};

describe('RemuneracaoController', () => {
  const servico = {
    consultar: jest.fn().mockResolvedValue({}),
    salvar: jest.fn().mockResolvedValue({}),
  };
  const controlador = new RemuneracaoController(
    servico as unknown as RemuneracaoService,
  );

  it('usa a empresa do token, nunca um id vindo do corpo', async () => {
    await controlador.consultar(EMPRESA);
    await controlador.salvar(EMPRESA, { taxaFixa: 800, coeficienteKm: 150 });

    expect(servico.consultar).toHaveBeenCalledWith(3);
    expect(servico.salvar).toHaveBeenCalledWith(3, {
      taxaFixa: 800,
      coeficienteKm: 150,
    });
  });
});
