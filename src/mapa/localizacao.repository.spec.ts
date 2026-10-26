import { PrismaService } from '../prisma/prisma.service';
import { LocalizacaoRepository } from './localizacao.repository';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

function montar() {
  const prisma = {
    pedido: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    },
    empresa: {
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    },
    localizacaoEntrega: {
      upsert: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const repositorio = new LocalizacaoRepository(
    prisma as unknown as PrismaService,
  );
  return { repositorio, prisma };
}

const INCLUI_MAPA = {
  empresa: {
    select: {
      id_empresa: true,
      exibir_mapa: true,
      origem_lat: true,
      origem_lng: true,
      cep: true,
      logradouro: true,
      numero: true,
      bairro: true,
      cidade: true,
      UF: true,
    },
  },
  entregador: { select: { tipo_veiculo: true } },
  localizacao: true,
};

describe('LocalizacaoRepository', () => {
  it('busca a empresa so com o endereco e a saida usados no mapa', async () => {
    const { repositorio, prisma } = montar();

    await repositorio.procurarEmpresa(1);

    expect(prisma.empresa.findUnique).toHaveBeenCalledWith({
      where: { id_empresa: 1 },
      select: INCLUI_MAPA.empresa.select,
    });
  });

  it('so encontra o pedido atribuido ao proprio entregador', async () => {
    const { repositorio, prisma } = montar();

    await repositorio.procurarDoEntregador(42, '98765432100');

    expect(prisma.pedido.findFirst).toHaveBeenCalledWith({
      where: { id_pedido: 42, cpf_entregador: '98765432100' },
      include: INCLUI_MAPA,
    });
  });

  it('so encontra o pedido da propria empresa', async () => {
    const { repositorio, prisma } = montar();

    await repositorio.procurarDaEmpresa(42, 1);

    expect(prisma.pedido.findFirst).toHaveBeenCalledWith({
      where: { id_pedido: 42, idEmpresa: 1 },
      include: INCLUI_MAPA,
    });
  });

  it('busca por id com a configuracao da empresa e a ultima posicao', async () => {
    const { repositorio, prisma } = montar();

    await repositorio.procurarPorId(42);

    expect(prisma.pedido.findUnique).toHaveBeenCalledWith({
      where: { id_pedido: 42 },
      include: INCLUI_MAPA,
    });
  });

  it('grava o destino geocodificado no pedido', async () => {
    const { repositorio, prisma } = montar();

    await repositorio.salvarDestino(42, { lat: -15.8, lng: -47.9 });

    expect(prisma.pedido.update).toHaveBeenCalledWith({
      where: { id_pedido: 42 },
      data: { destino_lat: -15.8, destino_lng: -47.9 },
    });
  });

  it('grava a origem geocodificada na empresa', async () => {
    const { repositorio, prisma } = montar();

    await repositorio.salvarOrigem(3, { lat: -15.83, lng: -47.92 });

    expect(prisma.empresa.update).toHaveBeenCalledWith({
      where: { id_empresa: 3 },
      data: { origem_lat: -15.83, origem_lng: -47.92 },
    });
  });

  it('mantem uma unica linha por pedido com a ultima posicao', async () => {
    const { repositorio, prisma } = montar();
    const dados = {
      lat: -15.79,
      lng: -47.88,
      precisao_m: 10,
      registrada_em: new Date('2026-10-15T12:00:00Z'),
      origem_rota_lat: null,
      origem_rota_lng: null,
      rota_polyline: null,
      distancia_restante_m: null,
      duracao_restante_s: null,
      estimado: true,
      rota_calculada_em: null,
    };

    await repositorio.salvarPosicao(42, dados);

    expect(prisma.localizacaoEntrega.upsert).toHaveBeenCalledWith({
      where: { idPedido: 42 },
      create: { idPedido: 42, ...dados },
      update: dados,
    });
  });

  it('apagar a posicao nao falha quando ela nao existe', async () => {
    const { repositorio, prisma } = montar();
    prisma.localizacaoEntrega.deleteMany.mockResolvedValue({ count: 0 });

    await expect(repositorio.apagarPosicao(42)).resolves.toBeUndefined();
    expect(prisma.localizacaoEntrega.deleteMany).toHaveBeenCalledWith({
      where: { idPedido: 42 },
    });
  });
});
