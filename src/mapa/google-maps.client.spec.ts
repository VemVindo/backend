import { ConfigService } from '@nestjs/config';
import {
  CAMPOS_DA_ROTA,
  EnderecoDoPedido,
  GoogleMapsClient,
  URL_GEOCODING,
  URL_ROUTES,
} from './google-maps.client';

const ORIGEM = { lat: -15.7939, lng: -47.8828 };
const DESTINO = { lat: -15.8, lng: -47.9 };
const ENDERECO: EnderecoDoPedido = {
  logradouro: 'SQN 210 Bloco K',
  numero: 304,
  bairro: 'Asa Norte',
  cidade: 'Brasilia',
  uf: 'DF',
  cep: '70000000',
};

function criar(chave?: string) {
  return new GoogleMapsClient({
    get: (nome: string) =>
      nome === 'GOOGLE_MAPS_SERVER_KEY' ? chave : undefined,
  } as unknown as ConfigService);
}

interface CorpoRoutes {
  origin: { location: { latLng: { latitude: number; longitude: number } } };
  travelMode: string;
  routingPreference?: string;
}

function responder(status: number, corpo: unknown) {
  const fetchMock = jest.fn<Promise<Response>, [string, RequestInit]>();
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify(corpo), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
  global.fetch = fetchMock;
  return fetchMock;
}

describe('GoogleMapsClient', () => {
  const fetchOriginal = global.fetch;

  afterEach(() => {
    global.fetch = fetchOriginal;
  });

  it('sem chave fica desabilitado e nao chama o Google', async () => {
    const fetchMock = responder(200, {});
    const client = criar('');

    expect(client.habilitado).toBe(false);
    expect(await client.geocodificar(ENDERECO)).toBeNull();
    expect(await client.calcularRota(ORIGEM, DESTINO, 'DRIVE')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  describe('geocodificar', () => {
    it('monta a busca do endereco no Brasil e devolve a coordenada', async () => {
      const fetchMock = responder(200, {
        status: 'OK',
        results: [{ geometry: { location: { lat: -15.76, lng: -47.88 } } }],
      });

      const coordenada = await criar('chave-teste').geocodificar(ENDERECO);

      expect(coordenada).toEqual({ lat: -15.76, lng: -47.88 });
      const url = new URL(fetchMock.mock.calls[0][0]);
      expect(`${url.origin}${url.pathname}`).toBe(URL_GEOCODING);
      expect(url.searchParams.get('address')).toBe(
        'SQN 210 Bloco K, 304 - Asa Norte, Brasilia - DF, 70000000',
      );
      expect(url.searchParams.get('components')).toBe('country:BR');
      expect(url.searchParams.get('key')).toBe('chave-teste');
    });

    it('devolve null quando o endereco nao e encontrado', async () => {
      responder(200, { status: 'ZERO_RESULTS', results: [] });
      expect(await criar('chave').geocodificar(ENDERECO)).toBeNull();
    });

    it('devolve null quando o Google recusa a chave', async () => {
      responder(403, { error: 'negado' });
      expect(await criar('chave').geocodificar(ENDERECO)).toBeNull();
    });

    it('devolve null quando a rede falha', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('timeout'));
      expect(await criar('chave').geocodificar(ENDERECO)).toBeNull();
    });
  });

  describe('calcularRota', () => {
    it('pede so os campos usados e converte a duracao', async () => {
      const fetchMock = responder(200, {
        routes: [
          {
            distanceMeters: 4200,
            duration: '780s',
            polyline: { encodedPolyline: 'abc123' },
          },
        ],
      });

      const rota = await criar('chave-teste').calcularRota(
        ORIGEM,
        DESTINO,
        'DRIVE',
      );

      expect(rota).toEqual({
        distanciaM: 4200,
        duracaoS: 780,
        polyline: 'abc123',
      });
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(URL_ROUTES);
      expect(init.headers).toMatchObject({
        'X-Goog-Api-Key': 'chave-teste',
        'X-Goog-FieldMask': CAMPOS_DA_ROTA,
      });
      const corpo = JSON.parse(init.body as string) as CorpoRoutes;
      expect(corpo.origin.location.latLng).toEqual({
        latitude: ORIGEM.lat,
        longitude: ORIGEM.lng,
      });
      expect(corpo.travelMode).toBe('DRIVE');
      expect(corpo.routingPreference).toBe('TRAFFIC_UNAWARE');
    });

    it('bicicleta nao manda preferencia de transito', async () => {
      const fetchMock = responder(200, {
        routes: [{ distanceMeters: 10, duration: '5s' }],
      });

      const rota = await criar('chave').calcularRota(
        ORIGEM,
        DESTINO,
        'BICYCLE',
      );

      expect(rota?.polyline).toBeNull();
      const corpo = JSON.parse(
        fetchMock.mock.calls[0][1].body as string,
      ) as CorpoRoutes;
      expect(corpo.routingPreference).toBeUndefined();
    });

    it('devolve null quando nao ha rota', async () => {
      responder(200, {});
      expect(
        await criar('chave').calcularRota(ORIGEM, DESTINO, 'DRIVE'),
      ).toBeNull();
    });
  });
});
