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
    distanciaParaFinalizar: jest.fn().mockResolvedValue(3100),
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
      null,
    );
  });

  it('usa o ponto marcado no mapa como destino', async () => {
    const { calculoDaEntrega, rotaDeCarro } = montar();
    const marcado = { ...pedido, destino_lat: -15.65, destino_lng: -47.79 };
    rotaDeCarro.calcular.mockResolvedValue({
      distanciaM: 2000,
      destino: { lat: -15.65, lng: -47.79 },
    });

    await expect(
      calculoDaEntrega.calcular(ID_EMPRESA, marcado),
    ).resolves.toMatchObject({ destinoLat: -15.65, destinoLng: -47.79 });
    expect(rotaDeCarro.calcular).toHaveBeenCalledWith(
      ID_EMPRESA,
      marcado,
      'BICYCLE',
      { lat: -15.65, lng: -47.79 },
    );
  });

  it('guarda o ponto marcado mesmo quando a rota falha', async () => {
    const { calculoDaEntrega, rotaDeCarro } = montar();
    rotaDeCarro.calcular.mockResolvedValue(null);

    await expect(
      calculoDaEntrega.calcular(ID_EMPRESA, {
        ...pedido,
        destino_lat: -15.65,
        destino_lng: -47.79,
      }),
    ).resolves.toMatchObject({
      distanciaConhecida: false,
      destinoLat: -15.65,
      destinoLng: -47.79,
    });
  });

  it('repassa o recalculo da distancia na finalizacao', async () => {
    const { calculoDaEntrega, rotaDeCarro } = montar();

    await expect(calculoDaEntrega.distanciaParaFinalizar(9)).resolves.toBe(
      3100,
    );
    expect(rotaDeCarro.distanciaParaFinalizar).toHaveBeenCalledWith(9);
  });

  it('ignora o ponto marcado pela metade', async () => {
    const { calculoDaEntrega, rotaDeCarro } = montar();

    await calculoDaEntrega.calcular(ID_EMPRESA, {
      ...pedido,
      destino_lat: -15.65,
    });

    expect(rotaDeCarro.calcular).toHaveBeenCalledWith(
      ID_EMPRESA,
      expect.anything(),
      'BICYCLE',
      null,
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
