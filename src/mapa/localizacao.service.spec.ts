import { ConflictException, Logger, NotFoundException } from '@nestjs/common';
import { LocalizacaoEntrega } from '../generated/prisma/client';
import { StatusPedido } from '../generated/prisma/enums';
import { estimarTrajeto } from './geo';
import { GoogleMapsClient } from './google-maps.client';
import { LocalizacaoRepository, PedidoComMapa } from './localizacao.repository';
import { LocalizacaoService } from './localizacao.service';
import {
  EVENTO_LOCALIZACAO,
  EVENTO_STATUS,
  RastreioGateway,
} from '../rastreio/rastreio.gateway';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

const CPF = '98765432100';
const ID_PEDIDO = 42;
const AGORA = new Date('2026-10-15T12:00:00Z');
const POSICAO = { lat: -15.7939, lng: -47.8828, precisao: 12 };
const DESTINO = { lat: -15.8, lng: -47.9 };
const ORIGEM = { lat: -15.83, lng: -47.92 };
const EMPRESA = {
  id_empresa: 3,
  exibir_mapa: true,
  origem_lat: ORIGEM.lat,
  origem_lng: ORIGEM.lng,
  cep: '70297400',
  logradouro: 'SCLS 308 Bloco A',
  numero: 10,
  bairro: 'Asa Sul',
  cidade: 'Brasilia',
  UF: 'DF',
};

function pedido(extra: Partial<PedidoComMapa> = {}): PedidoComMapa {
  return {
    id_pedido: ID_PEDIDO,
    status: StatusPedido.EM_ANDAMENTO,
    logradouro: 'SQN 210 Bloco K',
    numero: 304,
    bairro: 'Asa Norte',
    cidade: 'Brasilia',
    uf: 'DF',
    cep: '70000000',
    destino_lat: DESTINO.lat,
    destino_lng: DESTINO.lng,
    empresa: EMPRESA,
    entregador: { tipo_veiculo: 'MOTO' },
    localizacao: null,
    ...extra,
  } as PedidoComMapa;
}

function localizacaoAnterior(
  extra: Partial<LocalizacaoEntrega> = {},
): LocalizacaoEntrega {
  return {
    idPedido: ID_PEDIDO,
    lat: -15.79,
    lng: -47.88,
    precisao_m: 10,
    registrada_em: new Date(AGORA.getTime() - 10_000),
    origem_rota_lat: POSICAO.lat,
    origem_rota_lng: POSICAO.lng,
    rota_polyline: 'rota-antiga',
    distancia_restante_m: 5000,
    duracao_restante_s: 600,
    estimado: false,
    rota_calculada_em: new Date(AGORA.getTime() - 30_000),
    ...extra,
  };
}

function montar({ habilitado = true, encontrado = pedido() } = {}) {
  const repositorio = {
    procurarDoEntregador: jest.fn().mockResolvedValue(encontrado),
    procurarPorId: jest.fn().mockResolvedValue(encontrado),
    procurarDaEmpresa: jest.fn().mockResolvedValue(encontrado),
    salvarDestino: jest.fn().mockResolvedValue(undefined),
    salvarOrigem: jest.fn().mockResolvedValue(undefined),
    salvarPosicao: jest.fn((idPedido: number, dados: object) =>
      Promise.resolve({ idPedido, ...dados }),
    ),
    apagarPosicao: jest.fn().mockResolvedValue(undefined),
  };
  const maps = {
    habilitado,
    geocodificar: jest.fn().mockResolvedValue(DESTINO),
    calcularRota: jest.fn().mockResolvedValue({
      distanciaM: 4200,
      duracaoS: 780,
      polyline: 'rota-nova',
    }),
  };
  const gateway = {
    publicar: jest.fn<void, [number, string, unknown]>(),
    encerrarSala: jest.fn(),
  };
  const servico = new LocalizacaoService(
    repositorio as unknown as LocalizacaoRepository,
    maps as unknown as GoogleMapsClient,
    gateway as unknown as RastreioGateway,
  );
  return { servico, repositorio, maps, gateway };
}

describe('LocalizacaoService.registrarPosicao', () => {
  it('responde 404 para pedido que nao e do entregador', async () => {
    const { servico, repositorio } = montar({ encontrado: null as never });

    await expect(
      servico.registrarPosicao(CPF, ID_PEDIDO, POSICAO, AGORA),
    ).rejects.toThrow(NotFoundException);
    expect(repositorio.salvarPosicao).not.toHaveBeenCalled();
  });

  it.each([
    StatusPedido.PENDENTE,
    StatusPedido.FINALIZADO,
    StatusPedido.CANCELADO,
  ])('recusa posicao com o pedido %s', async (status) => {
    const { servico, repositorio } = montar({
      encontrado: pedido({ status }),
    });

    await expect(
      servico.registrarPosicao(CPF, ID_PEDIDO, POSICAO, AGORA),
    ).rejects.toThrow(ConflictException);
    expect(repositorio.salvarPosicao).not.toHaveBeenCalled();
  });

  it('calcula a rota no Google na primeira posicao', async () => {
    const { servico, repositorio, maps } = montar();

    const visao = await servico.registrarPosicao(
      CPF,
      ID_PEDIDO,
      POSICAO,
      AGORA,
    );

    expect(maps.calcularRota).toHaveBeenCalledWith(
      { lat: POSICAO.lat, lng: POSICAO.lng, precisao: 12 },
      DESTINO,
      'DRIVE',
    );
    expect(repositorio.salvarPosicao).toHaveBeenCalledWith(
      ID_PEDIDO,
      expect.objectContaining({
        lat: POSICAO.lat,
        lng: POSICAO.lng,
        precisao_m: 12,
        registrada_em: AGORA,
        origem_rota_lat: POSICAO.lat,
        rota_polyline: 'rota-nova',
        distancia_restante_m: 4200,
        duracao_restante_s: 780,
        estimado: false,
        rota_calculada_em: AGORA,
      }),
    );
    expect(visao).toMatchObject({
      status: StatusPedido.EM_ANDAMENTO,
      destino: DESTINO,
      entregador: { lat: POSICAO.lat, lng: POSICAO.lng, precisaoM: 12 },
      rota: 'rota-nova',
      distanciaRestanteM: 4200,
      duracaoRestanteS: 780,
      estimado: false,
      atualizadaEm: AGORA,
    });
  });

  it('mantem a rota do Google entre recalculos sem chamar a API', async () => {
    const { servico, repositorio, maps } = montar({
      encontrado: pedido({ localizacao: localizacaoAnterior() }),
    });

    await servico.registrarPosicao(CPF, ID_PEDIDO, POSICAO, AGORA);

    expect(maps.calcularRota).not.toHaveBeenCalled();
    expect(repositorio.salvarPosicao).toHaveBeenCalledWith(
      ID_PEDIDO,
      expect.objectContaining({
        lat: POSICAO.lat,
        rota_polyline: 'rota-antiga',
        distancia_restante_m: 5000,
        estimado: false,
      }),
    );
  });

  it('cai na estimativa em linha reta quando o Google falha', async () => {
    const { servico, repositorio, maps } = montar();
    maps.calcularRota.mockResolvedValue(null);

    const visao = await servico.registrarPosicao(
      CPF,
      ID_PEDIDO,
      POSICAO,
      AGORA,
    );

    const esperado = estimarTrajeto(POSICAO, DESTINO, 'MOTO');
    expect(visao).toMatchObject({
      rota: null,
      distanciaRestanteM: esperado.distanciaM,
      duracaoRestanteS: esperado.duracaoS,
      estimado: true,
    });
    expect(repositorio.salvarPosicao.mock.calls[0][1]).toMatchObject({
      rota_calculada_em: AGORA,
    });
  });

  it('depois de uma falha, espera o intervalo antes de tentar o Google de novo', async () => {
    const { servico, maps, repositorio } = montar({
      encontrado: pedido({
        localizacao: localizacaoAnterior({
          estimado: true,
          rota_polyline: null,
        }),
      }),
    });

    await servico.registrarPosicao(CPF, ID_PEDIDO, POSICAO, AGORA);

    expect(maps.calcularRota).not.toHaveBeenCalled();
    expect(repositorio.salvarPosicao.mock.calls[0][1]).toMatchObject({
      estimado: true,
      distancia_restante_m: estimarTrajeto(POSICAO, DESTINO, 'MOTO').distanciaM,
    });
  });

  it('sem chave do Google, estima a cada posicao', async () => {
    const { servico, maps } = montar({ habilitado: false });

    const visao = await servico.registrarPosicao(
      CPF,
      ID_PEDIDO,
      POSICAO,
      AGORA,
    );

    expect(maps.calcularRota).not.toHaveBeenCalled();
    expect(visao.estimado).toBe(true);
    expect(visao.distanciaRestanteM).toBe(
      estimarTrajeto(POSICAO, DESTINO, 'MOTO').distanciaM,
    );
  });

  it('aceita posicao sem precisao e usa o relogio do sistema', async () => {
    jest.useFakeTimers({ now: AGORA });
    const { servico, repositorio } = montar({
      habilitado: false,
      encontrado: pedido({ entregador: null }),
    });

    await servico.registrarPosicao(CPF, ID_PEDIDO, {
      lat: POSICAO.lat,
      lng: POSICAO.lng,
    });

    expect(repositorio.salvarPosicao).toHaveBeenCalledWith(
      ID_PEDIDO,
      expect.objectContaining({
        precisao_m: null,
        registrada_em: AGORA,
        distancia_restante_m: estimarTrajeto(POSICAO, DESTINO, '').distanciaM,
      }),
    );
    jest.useRealTimers();
  });

  it('geocodifica o destino uma vez e guarda no pedido', async () => {
    const { servico, repositorio, maps } = montar({
      encontrado: pedido({ destino_lat: null, destino_lng: null }),
    });

    const visao = await servico.registrarPosicao(
      CPF,
      ID_PEDIDO,
      POSICAO,
      AGORA,
    );

    expect(maps.geocodificar).toHaveBeenCalledWith(
      expect.objectContaining({
        logradouro: 'SQN 210 Bloco K',
        cep: '70000000',
      }),
    );
    expect(repositorio.salvarDestino).toHaveBeenCalledWith(ID_PEDIDO, DESTINO);
    expect(visao.destino).toEqual(DESTINO);
  });

  it('sem destino, guarda so a posicao e nao insiste na geocodificacao', async () => {
    const { servico, repositorio, maps } = montar({
      encontrado: pedido({ destino_lat: null, destino_lng: null }),
    });
    maps.geocodificar.mockResolvedValue(null);

    const visao = await servico.registrarPosicao(
      CPF,
      ID_PEDIDO,
      POSICAO,
      AGORA,
    );
    await servico.registrarPosicao(
      CPF,
      ID_PEDIDO,
      POSICAO,
      new Date(AGORA.getTime() + 60_000),
    );

    expect(maps.geocodificar).toHaveBeenCalledTimes(1);
    expect(maps.calcularRota).not.toHaveBeenCalled();
    expect(repositorio.salvarDestino).not.toHaveBeenCalled();
    expect(visao).toMatchObject({
      destino: null,
      distanciaRestanteM: null,
      duracaoRestanteS: null,
    });
  });

  it('publica para o recebedor com o mapa', async () => {
    const { servico, gateway } = montar();

    await servico.registrarPosicao(CPF, ID_PEDIDO, POSICAO, AGORA);

    const [idPedido, evento, publicada] = gateway.publicar.mock.calls[0];
    expect([idPedido, evento]).toEqual([ID_PEDIDO, EVENTO_LOCALIZACAO]);
    expect(publicada).toMatchObject({
      exibirMapa: true,
      entregador: { lat: POSICAO.lat, lng: POSICAO.lng },
    });
  });

  it('com o mapa desligado, o recebedor nao recebe coordenada nenhuma', async () => {
    const { servico, gateway } = montar({
      encontrado: pedido({ empresa: { ...EMPRESA, exibir_mapa: false } }),
    });

    const visaoDoEntregador = await servico.registrarPosicao(
      CPF,
      ID_PEDIDO,
      POSICAO,
      AGORA,
    );

    const publicada = gateway.publicar.mock.calls[0][2];
    expect(publicada).toMatchObject({
      exibirMapa: false,
      destino: null,
      entregador: null,
      rota: null,
      distanciaRestanteM: 4200,
      duracaoRestanteS: 780,
    });
    expect(JSON.stringify(publicada)).not.toContain(String(POSICAO.lat));
    expect(visaoDoEntregador.entregador).not.toBeNull();
  });
  it('ignora posicao repetida em menos de 2 s, sem gravar nem publicar', async () => {
    const { servico, repositorio, maps, gateway } = montar({
      encontrado: pedido({
        localizacao: localizacaoAnterior({
          registrada_em: new Date(AGORA.getTime() - 1_000),
        }),
      }),
    });

    const visao = await servico.registrarPosicao(
      CPF,
      ID_PEDIDO,
      POSICAO,
      AGORA,
    );

    expect(repositorio.salvarPosicao).not.toHaveBeenCalled();
    expect(maps.calcularRota).not.toHaveBeenCalled();
    expect(gateway.publicar).not.toHaveBeenCalled();
    expect(visao).toMatchObject({
      rota: 'rota-antiga',
      distanciaRestanteM: 5000,
    });
  });
});

describe('LocalizacaoService ponto de saida da empresa', () => {
  it('devolve a origem ja gravada sem geocodificar', async () => {
    const { servico, maps } = montar();

    const visao = await servico.registrarPosicao(
      CPF,
      ID_PEDIDO,
      POSICAO,
      AGORA,
    );

    expect(visao.origem).toEqual(ORIGEM);
    expect(maps.geocodificar).not.toHaveBeenCalled();
  });

  it('geocodifica o endereco da empresa uma vez e grava', async () => {
    const { servico, maps, repositorio } = montar({
      encontrado: pedido({
        empresa: { ...EMPRESA, origem_lat: null, origem_lng: null },
      }),
    });
    maps.geocodificar.mockResolvedValue(ORIGEM);

    const visao = await servico.registrarPosicao(
      CPF,
      ID_PEDIDO,
      POSICAO,
      AGORA,
    );

    expect(maps.geocodificar).toHaveBeenCalledWith(
      expect.objectContaining({ logradouro: 'SCLS 308 Bloco A', uf: 'DF' }),
    );
    expect(repositorio.salvarOrigem).toHaveBeenCalledWith(3, ORIGEM);
    expect(visao.origem).toEqual(ORIGEM);
  });

  it('com o mapa desligado, a origem tambem nao vai para o recebedor', async () => {
    const { servico } = montar({
      encontrado: pedido({ empresa: { ...EMPRESA, exibir_mapa: false } }),
    });

    const visao = await servico.consultarParaRecebedor(ID_PEDIDO);

    expect(visao.origem).toBeNull();
  });
});

describe('LocalizacaoService.consultarParaEntregador', () => {
  it('devolve destino e ultima posicao sem chamar a rota', async () => {
    const { servico, maps } = montar({
      encontrado: pedido({ localizacao: localizacaoAnterior() }),
    });

    const visao = await servico.consultarParaEntregador(CPF, ID_PEDIDO);

    expect(maps.calcularRota).not.toHaveBeenCalled();
    expect(visao).toMatchObject({
      destino: DESTINO,
      rota: 'rota-antiga',
      distanciaRestanteM: 5000,
    });
  });

  it('entrega encerrada nao gasta geocodificacao', async () => {
    const { servico, maps } = montar({
      encontrado: pedido({
        status: StatusPedido.FINALIZADO,
        destino_lat: null,
        destino_lng: null,
      }),
    });

    const visao = await servico.consultarParaEntregador(CPF, ID_PEDIDO);

    expect(maps.geocodificar).not.toHaveBeenCalled();
    expect(visao).toMatchObject({ status: 'FINALIZADO', destino: null });
  });

  it('responde 404 para pedido de outro entregador', async () => {
    const { servico } = montar({ encontrado: null as never });
    await expect(
      servico.consultarParaEntregador(CPF, ID_PEDIDO),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('LocalizacaoService.consultarParaEmpresa', () => {
  it('busca so entre os pedidos da empresa e mostra o mapa completo', async () => {
    const { servico, repositorio, maps } = montar({
      encontrado: pedido({ localizacao: localizacaoAnterior() }),
    });

    const visao = await servico.consultarParaEmpresa(7, ID_PEDIDO);

    expect(repositorio.procurarDaEmpresa).toHaveBeenCalledWith(ID_PEDIDO, 7);
    expect(maps.calcularRota).not.toHaveBeenCalled();
    expect(visao).toMatchObject({ destino: DESTINO, rota: 'rota-antiga' });
  });

  it('responde 404 para pedido de outra empresa', async () => {
    const { servico } = montar({ encontrado: null as never });

    await expect(servico.consultarParaEmpresa(7, ID_PEDIDO)).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('LocalizacaoService.consultarParaRecebedor', () => {
  it('esconde as coordenadas quando a empresa desligou o mapa', async () => {
    const { servico } = montar({
      encontrado: pedido({
        empresa: { ...EMPRESA, exibir_mapa: false },
        localizacao: localizacaoAnterior(),
      }),
    });

    const visao = await servico.consultarParaRecebedor(ID_PEDIDO);

    expect(visao).toMatchObject({
      exibirMapa: false,
      destino: null,
      entregador: null,
      rota: null,
      distanciaRestanteM: 5000,
      duracaoRestanteS: 600,
    });
  });

  it('sem posicao ainda, devolve so o destino', async () => {
    const { servico } = montar();

    const visao = await servico.consultarParaRecebedor(ID_PEDIDO);

    expect(visao).toMatchObject({
      exibirMapa: true,
      destino: DESTINO,
      entregador: null,
      atualizadaEm: null,
    });
  });

  it('responde 404 quando o pedido sumiu', async () => {
    const { servico } = montar({ encontrado: null as never });
    await expect(servico.consultarParaRecebedor(ID_PEDIDO)).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('LocalizacaoService ganchos do pedido', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('ao iniciar a entrega so avisa o novo status', async () => {
    const { servico, gateway, repositorio } = montar();

    const agora = new Date('2026-10-20T12:10:00Z');
    await servico.aoMudarStatus(ID_PEDIDO, StatusPedido.EM_ANDAMENTO, agora);

    expect(gateway.publicar).toHaveBeenCalledWith(ID_PEDIDO, EVENTO_STATUS, {
      status: StatusPedido.EM_ANDAMENTO,
      em: agora,
    });
    expect(repositorio.apagarPosicao).not.toHaveBeenCalled();
    expect(gateway.encerrarSala).not.toHaveBeenCalled();
  });

  it.each([StatusPedido.FINALIZADO, StatusPedido.CANCELADO])(
    'com o pedido %s apaga a posicao e fecha a sala',
    async (status) => {
      const { servico, gateway, repositorio } = montar();

      await servico.aoMudarStatus(ID_PEDIDO, status);

      expect(repositorio.apagarPosicao).toHaveBeenCalledWith(ID_PEDIDO);
      expect(gateway.encerrarSala).toHaveBeenCalledWith(ID_PEDIDO);
    },
  );

  it('uma falha ao encerrar nao estoura para quem mudou o status', async () => {
    const { servico, repositorio } = montar();
    repositorio.apagarPosicao.mockRejectedValue(new Error('banco fora'));

    await expect(
      servico.aoMudarStatus(ID_PEDIDO, StatusPedido.FINALIZADO),
    ).resolves.toBeUndefined();
  });

  it('ao trocar o entregador apaga a posicao antiga e avisa o recebedor', async () => {
    const { servico, gateway, repositorio } = montar();

    await servico.aoTrocarEntregador(ID_PEDIDO);

    expect(repositorio.apagarPosicao).toHaveBeenCalledWith(ID_PEDIDO);
    expect(gateway.publicar).toHaveBeenCalledWith(
      ID_PEDIDO,
      EVENTO_LOCALIZACAO,
      expect.objectContaining({ entregador: null }),
    );
  });

  it('uma falha ao trocar o entregador tambem nao estoura', async () => {
    const { servico, repositorio } = montar();
    repositorio.apagarPosicao.mockRejectedValue(new Error('banco fora'));

    await expect(
      servico.aoTrocarEntregador(ID_PEDIDO),
    ).resolves.toBeUndefined();
  });
});
