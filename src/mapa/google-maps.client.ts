import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Coordenada, ModoDeViagem, Trajeto } from './geo';

export const URL_GEOCODING =
  'https://maps.googleapis.com/maps/api/geocode/json';
export const URL_ROUTES =
  'https://routes.googleapis.com/directions/v2:computeRoutes';

export const CAMPOS_DA_ROTA =
  'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline';

const TEMPO_LIMITE_MS = 5_000;

export interface EnderecoDoPedido {
  logradouro: string;
  numero: number;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
}

export interface RotaCalculada extends Trajeto {
  polyline: string | null;
}

interface RespostaGeocoding {
  status?: string;
  results?: { geometry?: { location?: { lat?: number; lng?: number } } }[];
}

interface RespostaRoutes {
  routes?: {
    distanceMeters?: number;
    duration?: string;
    polyline?: { encodedPolyline?: string };
  }[];
}

@Injectable()
export class GoogleMapsClient {
  private readonly logger = new Logger(GoogleMapsClient.name);
  private readonly chave: string | undefined;

  constructor(config: ConfigService) {
    this.chave = config.get<string>('GOOGLE_MAPS_SERVER_KEY') || undefined;
  }

  get habilitado(): boolean {
    return this.chave !== undefined;
  }

  async geocodificar(endereco: EnderecoDoPedido): Promise<Coordenada | null> {
    if (!this.chave) {
      return null;
    }
    const parametros = new URLSearchParams({
      address: `${endereco.logradouro}, ${endereco.numero} - ${endereco.bairro}, ${endereco.cidade} - ${endereco.uf}, ${endereco.cep}`,
      components: 'country:BR',
      region: 'br',
      language: 'pt-BR',
      key: this.chave,
    });
    const corpo = await this.chamar<RespostaGeocoding>(
      'Geocoding',
      `${URL_GEOCODING}?${parametros.toString()}`,
      { method: 'GET' },
    );
    const local = corpo?.results?.[0]?.geometry?.location;
    if (
      corpo?.status !== 'OK' ||
      typeof local?.lat !== 'number' ||
      typeof local?.lng !== 'number'
    ) {
      if (corpo) {
        this.logger.warn(`Geocoding sem resultado: ${corpo.status}`);
      }
      return null;
    }
    return { lat: local.lat, lng: local.lng };
  }

  async calcularRota(
    origem: Coordenada,
    destino: Coordenada,
    modo: ModoDeViagem,
  ): Promise<RotaCalculada | null> {
    if (!this.chave) {
      return null;
    }
    const ponto = ({ lat, lng }: Coordenada) => ({
      location: { latLng: { latitude: lat, longitude: lng } },
    });
    const corpo = await this.chamar<RespostaRoutes>('Routes', URL_ROUTES, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.chave,
        'X-Goog-FieldMask': CAMPOS_DA_ROTA,
      },
      body: JSON.stringify({
        origin: ponto(origem),
        destination: ponto(destino),
        travelMode: modo,
        ...(modo === 'DRIVE' && { routingPreference: 'TRAFFIC_UNAWARE' }),
        languageCode: 'pt-BR',
        units: 'METRIC',
      }),
    });
    const rota = corpo?.routes?.[0];
    const duracaoS = Number.parseInt(rota?.duration ?? '', 10);
    if (typeof rota?.distanceMeters !== 'number' || Number.isNaN(duracaoS)) {
      return null;
    }
    return {
      distanciaM: rota.distanceMeters,
      duracaoS,
      polyline: rota.polyline?.encodedPolyline ?? null,
    };
  }

  private async chamar<T>(
    api: string,
    url: string,
    init: RequestInit,
  ): Promise<T | null> {
    try {
      const resposta = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
      });
      if (!resposta.ok) {
        this.logger.warn(`${api} respondeu HTTP ${resposta.status}`);
        return null;
      }
      return (await resposta.json()) as T;
    } catch (erro) {
      this.logger.warn(
        `${api} indisponivel: ${erro instanceof Error ? erro.name : 'erro'}`,
      );
      return null;
    }
  }
}
