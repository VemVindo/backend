import { ConflictException } from '@nestjs/common';
import { RotaDeCarroService } from '../../mapa/rota-de-carro.service';
import { CalculoValorEntregaService } from '../../remuneracao/calculo-valor-entrega.service';
import { RemuneracaoService } from '../../remuneracao/remuneracao.service';
import { CalculoDaEntregaService } from '../calculo-da-entrega.service';
import { CriarPedidoDto } from '../dto/criar-pedido.dto';

jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: class {},
}));

const ID_EMPRESA = 3;
const DESTINO = { lat: -15.83, lng: -47.92 };

const pedido = {
  logradouro: 'SQN 210 Bloco K',
  numero: 304,
  bairro: 'Asa Norte',
  cidade: 'Brasilia',
  uf: 'DF',
  cep: '70000000',
  tipo_veiculo: 'BICYCLE',
} as CriarPedidoDto;

function montar() {
  const remuneracaoService = {
    consultar: jest
      .fn()
      .mockResolvedValue({ taxaFixa: 500, coeficienteKm: 150 }),
  };
  const rotaDeCarro = {
    calcular: jest
      .fn()
      .mockResolvedValue({ distanciaM: 2000, destino: DESTINO }),
  };
  const calculoDaEntrega = new CalculoDaEntregaService(
    remuneracaoService as unknown as RemuneracaoService,
    new CalculoValorEntregaService(),
    rotaDeCarro as unknown as RotaDeCarroService,
  );
  return { calculoDaEntrega, remuneracaoService, rotaDeCarro };
}

describe('CalculoDaEntregaService', () => {
  it('calcula distancia, destino e valor pela rota do tipo de veiculo', async () => {
    const { calculoDaEntrega, rotaDeCarro } = montar();

    await expect(
      calculoDaEntrega.calcular(ID_EMPRESA, pedido),
    ).resolves.toEqual({
      distancia: 2000,
      distanciaConhecida: true,
      destinoLat: DESTINO.lat,
      destinoLng: DESTINO.lng,
      valorEntrega: 800,
    });
    expect(rotaDeCarro.calcular).toHaveBeenCalledWith(
      ID_EMPRESA,
      pedido,
      'BICYCLE',
    );
  });

  it('sem rota, grava distancia desconhecida e cobra so a taxa fixa', async () => {
    const { calculoDaEntrega, rotaDeCarro } = montar();
    rotaDeCarro.calcular.mockResolvedValue(null);

    await expect(
      calculoDaEntrega.calcular(ID_EMPRESA, pedido),
    ).resolves.toEqual({
      distancia: 0,
      distanciaConhecida: false,
      destinoLat: null,
      destinoLng: null,
      valorEntrega: 500,
    });
  });

  it.each([
    ['a taxa fixa', { taxaFixa: null, coeficienteKm: 150 }],
    ['o coeficiente por km', { taxaFixa: 500, coeficienteKm: null }],
  ])('responde 409 sem %s, sem calcular a rota', async (_caso, parametros) => {
    const { calculoDaEntrega, remuneracaoService, rotaDeCarro } = montar();
    remuneracaoService.consultar.mockResolvedValue(parametros);

    await expect(calculoDaEntrega.calcular(ID_EMPRESA, pedido)).rejects.toThrow(
      ConflictException,
    );
    expect(rotaDeCarro.calcular).not.toHaveBeenCalled();
  });
});
