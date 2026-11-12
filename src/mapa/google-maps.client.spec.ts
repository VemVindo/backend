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

function resposta(status: number, corpo: unknown) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function responder(status: number, corpo: unknown) {
  const fetchSimulado = jest.fn<Promise<Response>, [string, RequestInit]>();
  fetchSimulado.mockImplementation(() =>
    Promise.resolve(resposta(status, corpo)),
  );
  global.fetch = fetchSimulado;
  return fetchSimulado;
}

// Primeiro a busca so pelo CEP, depois a busca pelo texto.
function responderEmSequencia(...corpos: unknown[]) {
  const fetchSimulado = jest.fn<Promise<Response>, [string, RequestInit]>();
  corpos.forEach((corpo) =>
    fetchSimulado.mockResolvedValueOnce(resposta(200, corpo)),
  );
  global.fetch = fetchSimulado;
  return fetchSimulado;
}

function parametros(
  fetchSimulado: jest.Mock<Promise<Response>, [string, RequestInit]>,
  chamada: number,
) {
  return new URL(fetchSimulado.mock.calls[chamada][0]).searchParams;
}

function resultado(
  lat: number,
  bairro: string,
  cep: string,
  tipo = 'ROOFTOP',
): object {
  return {
    formatted_address: `${bairro}, Brasilia - DF, ${cep}`,
    geometry: { location: { lat, lng: -47.9 }, location_type: tipo },
    address_components: [
      { long_name: bairro, types: ['sublocality', 'political'] },
      {
        long_name: 'DF',
        short_name: 'DF',
        types: ['administrative_area_level_1'],
      },
      { long_name: cep, types: ['postal_code'] },
    ],
  };
}

const ACHADO = {
  status: 'OK',
  results: [resultado(-15.76, 'Asa Norte', '70000-000')],
};

describe('GoogleMapsClient', () => {
  const fetchVerdadeiro = global.fetch;

  afterEach(() => {
    global.fetch = fetchVerdadeiro;
  });

  it('sem chave fica desabilitado e nao chama o Google', async () => {
    const fetchSimulado = responder(200, {});
    const client = criar('');

    expect(client.habilitado).toBe(false);
    expect(await client.geocodificar(ENDERECO)).toBeNull();
    expect(await client.calcularRota(ORIGEM, DESTINO, 'DRIVE')).toBeNull();
    expect(fetchSimulado).not.toHaveBeenCalled();
  });

  describe('geocodificar', () => {
    it('busca pelo CEP e pelo texto e troca o centro do CEP pela porta', async () => {
      const fetchSimulado = responderEmSequencia(
        {
          status: 'OK',
          results: [
            resultado(-15.759, 'Asa Norte', '70000-000', 'APPROXIMATE'),
          ],
        },
        ACHADO,
      );

      const localizado = await criar('chave-teste').localizar(ENDERECO);

      expect(localizado).toEqual({
        coordenada: { lat: -15.76, lng: -47.9 },
        precisao: 'exato',
        enderecoEncontrado: 'Asa Norte, Brasilia - DF, 70000-000',
      });
      expect(fetchSimulado).toHaveBeenCalledTimes(2);
      const url = new URL(fetchSimulado.mock.calls[0][0]);
      expect(`${url.origin}${url.pathname}`).toBe(URL_GEOCODING);
      expect(url.searchParams.get('components')).toBe(
        'country:BR|postal_code:70000-000',
      );
      expect(url.searchParams.get('address')).toBeNull();
      expect(url.searchParams.get('key')).toBe('chave-teste');
      expect(parametros(fetchSimulado, 1).get('address')).toBe(
        'SQN 210 Bloco K, 304 - Asa Norte, Brasilia - DF, 70000-000',
      );
      expect(parametros(fetchSimulado, 1).get('components')).toBe(
        'country:BR|administrative_area:DF',
      );
    });

    it('geocodificar devolve so a coordenada', async () => {
      responder(200, ACHADO);
      expect(await criar('chave').geocodificar(ENDERECO)).toEqual({
        lat: -15.76,
        lng: -47.9,
      });
    });

    it('descarta o parecido de outro bairro e usa o centro do CEP', async () => {
      responderEmSequencia(
        {
          status: 'OK',
          results: [resultado(-15.75, 'Asa Norte', '70000-000', 'APPROXIMATE')],
        },
        { status: 'OK', results: [resultado(-15.79, 'Sudoeste', '70670-000')] },
      );

      await expect(criar('chave').localizar(ENDERECO)).resolves.toMatchObject({
        coordenada: { lat: -15.75, lng: -47.9 },
        precisao: 'aproximado',
      });
    });

    it('ignora a porta exata com outro CEP completo', async () => {
      responderEmSequencia(
        {
          status: 'OK',
          results: [resultado(-15.75, 'Asa Norte', '70000-000', 'APPROXIMATE')],
        },
        {
          status: 'OK',
          results: [
            resultado(-15.77, 'Asa Norte', '70000-999', 'RANGE_INTERPOLATED'),
          ],
        },
      );

      await expect(criar('chave').localizar(ENDERECO)).resolves.toMatchObject({
        coordenada: { lat: -15.75, lng: -47.9 },
        precisao: 'aproximado',
      });
    });

    it('trata a resposta OK sem lista de resultados como vazia', async () => {
      responder(200, { status: 'OK' });
      expect(await criar('chave').localizar(ENDERECO)).toBeNull();
    });

    it('devolve null quando nada confere com o endereco', async () => {
      responder(200, {
        status: 'OK',
        results: [resultado(-15.79, 'Sudoeste', '70670-000')],
      });
      expect(await criar('chave').localizar(ENDERECO)).toBeNull();
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

    it('devolve null quando a falha nao e um Error', async () => {
      global.fetch = jest.fn().mockRejectedValue('abortado');
      expect(await criar('chave').geocodificar(ENDERECO)).toBeNull();
    });

    it('devolve null quando a resposta OK vem sem coordenada', async () => {
      responder(200, { status: 'OK', results: [] });
      expect(await criar('chave').geocodificar(ENDERECO)).toBeNull();

      responder(200, {
        status: 'OK',
        results: [{ geometry: { location: { lat: '-15', lng: -47 } } }],
      });
      expect(await criar('chave').geocodificar(ENDERECO)).toBeNull();
    });
  });

  describe('calcularRota', () => {
    it('pede so os campos usados e converte a duracao', async () => {
      const fetchSimulado = responder(200, {
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
      const [url, init] = fetchSimulado.mock.calls[0];
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
      const fetchSimulado = responder(200, {
        routes: [{ distanceMeters: 10, duration: '5s' }],
      });

      const rota = await criar('chave').calcularRota(
        ORIGEM,
        DESTINO,
        'BICYCLE',
      );

      expect(rota?.polyline).toBeNull();
      const corpo = JSON.parse(
        fetchSimulado.mock.calls[0][1].body as string,
      ) as CorpoRoutes;
      expect(corpo.routingPreference).toBeUndefined();
    });

    it('devolve null quando nao ha rota', async () => {
      responder(200, {});
      expect(
        await criar('chave').calcularRota(ORIGEM, DESTINO, 'DRIVE'),
      ).toBeNull();
    });

    it.each([
      ['sem distancia', { duration: '5s' }],
      ['sem duracao', { distanceMeters: 10 }],
      ['com duracao ilegivel', { distanceMeters: 10, duration: 'rapido' }],
    ])('devolve null para rota %s', async (_caso, rota) => {
      responder(200, { routes: [rota] });
      expect(
        await criar('chave').calcularRota(ORIGEM, DESTINO, 'DRIVE'),
      ).toBeNull();
    });
  });
});
