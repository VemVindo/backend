import { Coordenada } from './geo';
import { GoogleMapsClient, RotaCalculada } from './google-maps.client';
import { EmpresaDoMapa, LocalizacaoRepository } from './localizacao.repository';
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

function montar() {
  const maps = {
    habilitado: true,
    geocodificar: jest
      .fn<
        Promise<Coordenada | null>,
        Parameters<GoogleMapsClient['geocodificar']>
      >()
      .mockResolvedValue(ENTREGA),
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
  });

  it('geocodifica e salva a saida da empresa na primeira vez', async () => {
    const { servico, maps, localizacoes } = montar();
    localizacoes.procurarEmpresa.mockResolvedValue(
      empresa({ origem_lat: null, origem_lng: null }),
    );
    maps.geocodificar.mockResolvedValueOnce(SAIDA);

    await servico.calcular(CANTINA, ENDERECO_DO_RECEBEDOR);

    expect(maps.geocodificar).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ logradouro: 'SCS Quadra 2', uf: 'DF' }),
    );
    expect(localizacoes.salvarOrigem).toHaveBeenCalledWith(CANTINA, SAIDA);
    expect(maps.calcularRota).toHaveBeenCalledWith(SAIDA, ENTREGA, 'DRIVE');
  });

  it('nao chama o Google sem chave configurada', async () => {
    const { servico, maps, localizacoes } = montar();
    maps.habilitado = false;

    await expect(
      servico.calcular(CANTINA, ENDERECO_DO_RECEBEDOR),
    ).resolves.toBeNull();
    expect(localizacoes.procurarEmpresa).not.toHaveBeenCalled();
    expect(maps.geocodificar).not.toHaveBeenCalled();
  });

  it('desiste quando o endereco da empresa nao e encontrado', async () => {
    const { servico, maps, localizacoes } = montar();
    localizacoes.procurarEmpresa.mockResolvedValue(
      empresa({ origem_lat: null, origem_lng: null }),
    );
    maps.geocodificar.mockResolvedValueOnce(null);

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

  it('desiste quando o Google nao devolve rota', async () => {
    const { servico, maps } = montar();
    maps.calcularRota.mockResolvedValue(null);

    await expect(
      servico.calcular(CANTINA, ENDERECO_DO_RECEBEDOR),
    ).resolves.toBeNull();
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
