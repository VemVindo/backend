import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  MinLength,
  validateSync,
} from 'class-validator';

export class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  @IsString()
  @IsOptional()
  DIRECT_URL?: string;

  @IsNumberString()
  @IsOptional()
  DB_POOL_MAX?: string;

  @IsString()
  @MinLength(32)
  JWT_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRES_IN?: string;

  @IsString()
  @IsOptional()
  CORS_ORIGIN?: string;

  @IsString()
  @IsOptional()
  URL_FRONTEND?: string;

  @IsString()
  @IsOptional()
  PORT?: string;

  @IsNumberString()
  @IsOptional()
  TRUST_PROXY?: string;

  // 'none' quando front e API estao em sites diferentes. Default: 'lax'.
  @IsIn(['lax', 'none'])
  @IsOptional()
  COOKIE_SAMESITE?: 'lax' | 'none';

  // Routes API e Geocoding API. Sem ela, distancia e tempo sao estimados em
  // linha reta e o endereco do pedido nao vira coordenada.
  @IsString()
  @IsOptional()
  GOOGLE_MAPS_SERVER_KEY?: string;
}

export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: false,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(`Configuração de ambiente inválida:\n${errors.toString()}`);
  }
  exigirFrontHttpsEmProducao(validated, config.NODE_ENV);
  return validated;
}

// O link do recebedor e montado com URL_FRONTEND (ou CORS_ORIGIN, na falta
// dela) e leva o token de rastreio. Em HTTP, o token trafega aberto na rede.
function exigirFrontHttpsEmProducao(
  env: EnvironmentVariables,
  nodeEnv: unknown,
): void {
  if (nodeEnv !== 'production') {
    return;
  }
  const enderecoDoFront = env.URL_FRONTEND ?? env.CORS_ORIGIN;
  if (!enderecoDoFront?.startsWith('https://')) {
    throw new Error(
      'Configuração de ambiente inválida:\nEm produção, URL_FRONTEND (ou CORS_ORIGIN) precisa começar com https://',
    );
  }
}
