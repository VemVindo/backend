import { Coordenada, estimarTrajeto } from './geo';
import { GoogleMapsClient, RotaCalculada } from './google-maps.client';
import {
  EmpresaDoMapa,
  LocalizacaoRepository,
  PedidoComMapa,
} from './localizacao.repository';
import { RotaDeCarroService } from './rota-de-carro.service';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

const CANTINA = 1;
const SAIDA: Coordenada = { lat: -15.79, lng: -47.89 };
const ENTREGA: Coordenada = { lat: -15.75, lng: -47.88 };
const ENDERECO_DO_RECEBEDOR = {
  logradouro: 'SQN 210 Bloco K',
  numero: 304,
  bairro: 'Asa Norte',
  cidade: 'Brasilia',
  uf: 'DF',
  cep: '70000000',
};

function empresa(dados: Partial<EmpresaDoMapa> = {}): EmpresaDoMapa {
  return {
    id_empresa: CANTINA,
    exibir_mapa: true,
    origem_lat: SAIDA.lat,
    origem_lng: SAIDA.lng,
    cep: '70300000',
    logradouro: 'SCS Quadra 2',
    numero: 10,
    bairro: 'Asa Sul',
    cidade: 'Brasilia',
    UF: 'DF',
    ...dados,
  };
}

function pedidoSemDistancia(dados: Partial<PedidoComMapa> = {}) {
  return {
    id_pedido: 9,
    ...ENDERECO_DO_RECEBEDOR,
    destino_lat: ENTREGA.lat,
    destino_lng: ENTREGA.lng,
    empresa: empresa(),
    entregador: { tipo_veiculo: 'BICICLETA' },
    localizacao: null,
    ...dados,
  } as PedidoComMapa;
}

function montar() {
  const maps = {
    habilitado: true,
    geocodificar: jest
      .fn<
        Promise<Coordenada | null>,
        Parameters<GoogleMapsClient['geocodificar']>
      >()
      .mockResolvedValue(ENTREGA),
    geocodificarOrigem: jest
      .fn<
        Promise<Coordenada | null>,
        Parameters<GoogleMapsClient['geocodificarOrigem']>
      >()
      .mockResolvedValue(SAIDA),
    localizar: jest.fn().mockResolvedValue({
      coordenada: ENTREGA,
      precisao: 'exato',
      enderecoEncontrado: 'SQN 210, Brasília - DF',
    }),
    localizarOrigem: jest.fn().mockResolvedValue({
      coordenada: SAIDA,
      precisao: 'aproximado',
      enderecoEncontrado: null,
    }),
    calcularRota: jest
      .fn<
        Promise<RotaCalculada | null>,
        Parameters<GoogleMapsClient['calcularRota']>
      >()
      .mockResolvedValue({ distanciaM: 4200, duracaoS: 600, polyline: null }),
  };
  const localizacoes = {
    procurarEmpresa: jest
      .fn<Promise<EmpresaDoMapa | null>, [number]>()
      .mockResolvedValue(empresa()),
    salvarOrigem: jest.fn().mockResolvedValue(undefined),
    procurarPorId: jest
      .fn<Promise<PedidoComMapa | null>, [number]>()
      .mockResolvedValue(pedidoSemDistancia()),
  };
  const servico = new RotaDeCarroService(
    maps as unknown as GoogleMapsClient,
    localizacoes as unknown as LocalizacaoRepository,
  );
  return { servico, maps, localizacoes };
}

describe('RotaDeCarroService.calcular', () => {
  it('pede a rota de carro da empresa ate o recebedor', async () => {
    const { servico, maps } = montar();

    await expect(
      servico.calcular(CANTINA, ENDERECO_DO_RECEBEDOR),
    ).resolves.toEqual({ distanciaM: 4200, destino: ENTREGA });
    expect(maps.geocodificar).toHaveBeenCalledWith(ENDERECO_DO_RECEBEDOR);
    expect(maps.calcularRota).toHaveBeenCalledWith(SAIDA, ENTREGA, 'DRIVE');
  });

  it('pede a rota no modo de viagem informado', async () => {
    const { servico, maps } = montar();

    await servico.calcular(CANTINA, ENDERECO_DO_RECEBEDOR, 'BICYCLE');

    expect(maps.calcularRota).toHaveBeenCalledWith(SAIDA, ENTREGA, 'BICYCLE');
  });

  it('usa a coordenada ja salva da empresa sem geocodificar de novo', async () => {
    const { servico, maps } = montar();

    await servico.calcular(CANTINA, ENDERECO_DO_RECEBEDOR);

    expect(maps.geocodificar).toHaveBeenCalledTimes(1);
    expect(maps.geocodificarOrigem).not.toHaveBeenCalled();
  });

  it('geocodifica e salva a saida da empresa na primeira vez', async () => {
    const { servico, maps, localizacoes } = montar();
    localizacoes.procurarEmpresa.mockResolvedValue(
      empresa({ origem_lat: null, origem_lng: null }),
    );

    await servico.calcular(CANTINA, ENDERECO_DO_RECEBEDOR);

    expect(maps.geocodificarOrigem).toHaveBeenCalledWith(
      expect.objectContaining({ logradouro: 'SCS Quadra 2', uf: 'DF' }),
    );
    expect(maps.geocodificar).toHaveBeenCalledWith(ENDERECO_DO_RECEBEDOR);
    expect(localizacoes.salvarOrigem).toHaveBeenCalledWith(CANTINA, SAIDA);
    expect(maps.calcularRota).toHaveBeenCalledWith(SAIDA, ENTREGA, 'DRIVE');
  });

  it('nao chama o Google sem chave configurada', async () => {
    const { servico, maps, localizacoes } = montar();
    maps.habilitado = false;
    maps.geocodificar.mockResolvedValue(null);

    await expect(
      servico.calcular(CANTINA, ENDERECO_DO_RECEBEDOR),
    ).resolves.toBeNull();
    expect(localizacoes.procurarEmpresa).toHaveBeenCalledWith(CANTINA);
    expect(maps.geocodificar).not.toHaveBeenCalled();
    expect(maps.calcularRota).not.toHaveBeenCalled();
  });

  it('estima a distancia com os pontos salvos mesmo sem chave do Google', async () => {
    const { servico, maps } = montar();
    maps.habilitado = false;

    await expect(
      servico.calcular(CANTINA, ENDERECO_DO_RECEBEDOR, 'BICYCLE', ENTREGA),
    ).resolves.toEqual({
      distanciaM: estimarTrajeto(SAIDA, ENTREGA, 'BICYCLE').distanciaM,
      destino: ENTREGA,
    });
    expect(maps.geocodificar).not.toHaveBeenCalled();
    expect(maps.calcularRota).not.toHaveBeenCalled();
  });

  it('desiste quando o endereco da empresa nao e encontrado', async () => {
    const { servico, maps, localizacoes } = montar();
    localizacoes.procurarEmpresa.mockResolvedValue(
      empresa({ origem_lat: null, origem_lng: null }),
    );
    maps.geocodificarOrigem.mockResolvedValueOnce(null);

    await expect(
      servico.calcular(CANTINA, ENDERECO_DO_RECEBEDOR),
    ).resolves.toBeNull();
    expect(localizacoes.salvarOrigem).not.toHaveBeenCalled();
    expect(maps.calcularRota).not.toHaveBeenCalled();
  });

  it('desiste quando o endereco do recebedor nao e encontrado', async () => {
    const { servico, maps } = montar();
    maps.geocodificar.mockResolvedValue(null);

    await expect(
      servico.calcular(CANTINA, ENDERECO_DO_RECEBEDOR),
    ).resolves.toBeNull();
    expect(maps.calcularRota).not.toHaveBeenCalled();
  });

  it('estima a distancia quando o Google nao devolve rota', async () => {
    const { servico, maps } = montar();
    maps.calcularRota.mockResolvedValue(null);

    await expect(
      servico.calcular(CANTINA, ENDERECO_DO_RECEBEDOR),
    ).resolves.toEqual({
      distanciaM: estimarTrajeto(SAIDA, ENTREGA, 'DRIVE').distanciaM,
      destino: ENTREGA,
    });
  });

  it('desiste quando a empresa nao existe', async () => {
    const { servico, maps, localizacoes } = montar();
    localizacoes.procurarEmpresa.mockResolvedValue(null);

    await expect(
      servico.calcular(CANTINA, ENDERECO_DO_RECEBEDOR),
    ).resolves.toBeNull();
    expect(maps.geocodificar).not.toHaveBeenCalled();
  });
});

describe('RotaDeCarroService com o ponto marcado no mapa', () => {
  it('usa o ponto marcado sem geocodificar o endereco do recebedor', async () => {
    const { servico, maps } = montar();
    const marcado = { lat: -15.65, lng: -47.79 };

    await expect(
      servico.calcular(CANTINA, ENDERECO_DO_RECEBEDOR, 'DRIVE', marcado),
    ).resolves.toEqual({ distanciaM: 4200, destino: marcado });
    expect(maps.geocodificar).not.toHaveBeenCalled();
    expect(maps.calcularRota).toHaveBeenCalledWith(SAIDA, marcado, 'DRIVE');
  });

  it('localiza o endereco pedido pelo cadastro', async () => {
    const { servico, maps } = montar();

    await expect(
      servico.localizarEndereco(ENDERECO_DO_RECEBEDOR),
    ).resolves.toEqual({
      coordenada: ENTREGA,
      precisao: 'exato',
      enderecoEncontrado: 'SQN 210, Brasília - DF',
    });
    expect(maps.localizar).toHaveBeenCalledWith(ENDERECO_DO_RECEBEDOR);
  });

  it('localiza a origem da empresa com a regra que aceita o bairro', async () => {
    const { servico, maps } = montar();

    await expect(
      servico.localizarOrigem(ENDERECO_DO_RECEBEDOR),
    ).resolves.toEqual({
      coordenada: SAIDA,
      precisao: 'aproximado',
      enderecoEncontrado: null,
    });
    expect(maps.localizarOrigem).toHaveBeenCalledWith(ENDERECO_DO_RECEBEDOR);
  });
});

describe('RotaDeCarroService.distanciaParaFinalizar', () => {
  it('recalcula a rota da empresa ate o destino salvo', async () => {
    const { servico, maps } = montar();

    await expect(servico.distanciaParaFinalizar(9)).resolves.toBe(4200);
    expect(maps.calcularRota).toHaveBeenCalledWith(SAIDA, ENTREGA, 'BICYCLE');
    expect(maps.geocodificar).not.toHaveBeenCalled();
  });

  it('estima em linha reta quando o Google nao devolve rota', async () => {
    const { servico, maps } = montar();
    maps.calcularRota.mockResolvedValue(null);

    const distancia = await servico.distanciaParaFinalizar(9);

    expect(distancia).toBeGreaterThan(4000);
    expect(distancia).toBeLessThan(7000);
  });

  it('estima mesmo sem chave do Google quando ja tem os dois pontos', async () => {
    const { servico, maps } = montar();
    maps.habilitado = false;
    maps.calcularRota.mockResolvedValue(null);

    await expect(servico.distanciaParaFinalizar(9)).resolves.toEqual(
      expect.any(Number),
    );
  });

  it('usa a ultima posicao do entregador quando o destino nao foi achado', async () => {
    const { servico, maps, localizacoes } = montar();
    const posicao = { lat: -15.66, lng: -47.8 };
    localizacoes.procurarPorId.mockResolvedValue(
      pedidoSemDistancia({
        destino_lat: null,
        destino_lng: null,
        localizacao: posicao as PedidoComMapa['localizacao'],
      }),
    );

    await servico.distanciaParaFinalizar(9);

    expect(maps.calcularRota).toHaveBeenCalledWith(SAIDA, posicao, 'BICYCLE');
    expect(maps.geocodificar).not.toHaveBeenCalled();
  });

  it('geocodifica o endereco quando nao ha destino nem posicao', async () => {
    const { servico, maps, localizacoes } = montar();
    localizacoes.procurarPorId.mockResolvedValue(
      pedidoSemDistancia({ destino_lat: null, destino_lng: null }),
    );

    await servico.distanciaParaFinalizar(9);

    expect(maps.geocodificar).toHaveBeenCalledWith(
      expect.objectContaining({ logradouro: 'SQN 210 Bloco K' }),
    );
    expect(maps.calcularRota).toHaveBeenCalledWith(SAIDA, ENTREGA, 'BICYCLE');
  });

  it('desiste sem destino conhecido', async () => {
    const { servico, maps, localizacoes } = montar();
    localizacoes.procurarPorId.mockResolvedValue(
      pedidoSemDistancia({ destino_lat: null, destino_lng: null }),
    );
    maps.geocodificar.mockResolvedValue(null);

    await expect(servico.distanciaParaFinalizar(9)).resolves.toBeNull();
    expect(maps.calcularRota).not.toHaveBeenCalled();
  });

  it('sem entregador vinculado, calcula a rota de carro', async () => {
    const { servico, maps, localizacoes } = montar();
    localizacoes.procurarPorId.mockResolvedValue(
      pedidoSemDistancia({ entregador: null }),
    );

    await servico.distanciaParaFinalizar(9);

    expect(maps.calcularRota).toHaveBeenCalledWith(SAIDA, ENTREGA, 'DRIVE');
  });

  it('desiste quando o pedido nao existe', async () => {
    const { servico, localizacoes } = montar();
    localizacoes.procurarPorId.mockResolvedValue(null);

    await expect(servico.distanciaParaFinalizar(9)).resolves.toBeNull();
  });
});
