import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EnderecoLocalizado,
  escolherResultado,
  ResultadoDoGeocoding,
} from './escolha-do-geocoding';
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
  results?: ResultadoDoGeocoding[];
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

  constructor(configuracao: ConfigService) {
    this.chave =
      configuracao.get<string>('GOOGLE_MAPS_SERVER_KEY') || undefined;
  }

  get habilitado(): boolean {
    return this.chave !== undefined;
  }

  async geocodificar(endereco: EnderecoDoPedido): Promise<Coordenada | null> {
    return (await this.localizar(endereco))?.coordenada ?? null;
  }

  /** Busca pelo CEP e pelo texto ao mesmo tempo; o CEP completo decide (ver escolherResultado). */
  async localizar(
    endereco: EnderecoDoPedido,
  ): Promise<EnderecoLocalizado | null> {
    const chave = this.chave;
    if (!chave) {
      return null;
    }
    const [porCep, porTexto] = await Promise.all([
      this.buscar(chave, {
        components: `country:BR|postal_code:${cepComHifen(endereco.cep)}`,
      }),
      this.buscar(chave, {
        address: textoDoEndereco(endereco),
        components: `country:BR|administrative_area:${endereco.uf}`,
      }),
    ]);
    const localizado = escolherResultado(porCep, porTexto, endereco);
    if (!localizado) {
      this.logger.warn('Geocoding sem resultado que confira com o endereco');
    }
    return localizado;
  }

  private async buscar(
    chave: string,
    filtros: Record<string, string>,
  ): Promise<ResultadoDoGeocoding[]> {
    const parametros = new URLSearchParams({
      ...filtros,
      region: 'br',
      language: 'pt-BR',
      key: chave,
    });
    const corpo = await this.chamar<RespostaGeocoding>(
      'Geocoding',
      `${URL_GEOCODING}?${parametros.toString()}`,
      { method: 'GET' },
    );
    if (corpo?.status !== 'OK') {
      if (corpo) {
        this.logger.warn(`Geocoding sem resultado: ${corpo.status}`);
      }
      return [];
    }
    return corpo.results ?? [];
  }

  async calcularRota(
    origem: Coordenada,
    destino: Coordenada,
    modo: ModoDeViagem,
  ): Promise<RotaCalculada | null> {
    if (!this.chave) {
      return null;
    }
    const corpo = await this.chamar<RespostaRoutes>('Routes', URL_ROUTES, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.chave,
        'X-Goog-FieldMask': CAMPOS_DA_ROTA,
      },
      body: JSON.stringify({
        origin: pontoDaRota(origem),
        destination: pontoDaRota(destino),
        travelMode: modo,
        ...(modo === 'DRIVE' && { routingPreference: 'TRAFFIC_UNAWARE' }),
        languageCode: 'pt-BR',
        units: 'METRIC',
      }),
    });
    return rotaDaResposta(corpo);
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

function textoDoEndereco(endereco: EnderecoDoPedido): string {
  const { logradouro, numero, bairro, cidade, uf, cep } = endereco;
  return `${logradouro}, ${numero} - ${bairro}, ${cidade} - ${uf}, ${cepComHifen(cep)}`;
}

function cepComHifen(cep: string): string {
  const digitos = cep.replace(/\D/g, '');
  return `${digitos.slice(0, 5)}-${digitos.slice(5)}`;
}

function pontoDaRota({ lat, lng }: Coordenada) {
  return { location: { latLng: { latitude: lat, longitude: lng } } };
}

function rotaDaResposta(corpo: RespostaRoutes | null): RotaCalculada | null {
  const rota = corpo?.routes?.[0];
  if (!rota) {
    return null;
  }
  const duracaoS = Number.parseInt(rota.duration ?? '', 10);
  if (typeof rota.distanceMeters !== 'number' || Number.isNaN(duracaoS)) {
    return null;
  }
  return {
    distanciaM: rota.distanceMeters,
    duracaoS,
    polyline: rota.polyline?.encodedPolyline ?? null,
  };
}
