import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import type { UsuarioAutenticado } from '../auth/jwt.strategy';
import { Cargo } from '../common/enums/cargo.enum';
import type { AcessoComPedido } from '../rastreio/rastreio.repository';
import { RegistrarPosicaoDto } from './dto/registrar-posicao.dto';
import { LocalizacaoController } from './localizacao.controller';
import { LocalizacaoService } from './localizacao.service';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

const ENTREGADOR: UsuarioAutenticado = {
  usuarioId: '98765432100',
  cargo: Cargo.ENTREGADOR,
};

function montar() {
  const service = {
    registrarPosicao: jest.fn().mockResolvedValue({ status: 'EM_ANDAMENTO' }),
    consultarParaEntregador: jest.fn().mockResolvedValue({}),
    consultarParaRecebedor: jest.fn().mockResolvedValue({}),
  };
  const controller = new LocalizacaoController(
    service as unknown as LocalizacaoService,
  );
  return { controller, service };
}

function errosDa(corpo: object): string[] {
  return validateSync(plainToInstance(RegistrarPosicaoDto, corpo)).map(
    (erro) => erro.property,
  );
}

describe('LocalizacaoController', () => {
  it('registra a posicao com o CPF do entregador logado', async () => {
    const { controller, service } = montar();
    const posicao = { lat: -15.79, lng: -47.88, precisao: 8 };

    await controller.registrarPosicao(ENTREGADOR, 42, posicao);

    expect(service.registrarPosicao).toHaveBeenCalledWith(
      '98765432100',
      42,
      posicao,
    );
  });

  it('consulta a rota do entregador logado', async () => {
    const { controller, service } = montar();

    await controller.consultarRota(ENTREGADOR, 42);

    expect(service.consultarParaEntregador).toHaveBeenCalledWith(
      '98765432100',
      42,
    );
  });

  it('o recebedor consulta o pedido do proprio link', async () => {
    const { controller, service } = montar();

    await controller.consultarParaRecebedor({
      idPedido: 42,
    } as AcessoComPedido);

    expect(service.consultarParaRecebedor).toHaveBeenCalledWith(42);
  });
});

describe('RegistrarPosicaoDto', () => {
  it('aceita coordenada valida, com ou sem precisao', () => {
    expect(errosDa({ lat: -15.79, lng: -47.88 })).toEqual([]);
    expect(errosDa({ lat: 90, lng: -180, precisao: 0 })).toEqual([]);
  });

  it('recusa coordenada fora do globo, texto e precisao negativa', () => {
    expect(errosDa({ lat: 91, lng: 0 })).toEqual(['lat']);
    expect(errosDa({ lat: 0, lng: -181 })).toEqual(['lng']);
    expect(errosDa({ lat: '1', lng: 0 })).toEqual(['lat']);
    expect(errosDa({ lat: 0, lng: 0, precisao: -1 })).toEqual(['precisao']);
  });
});
