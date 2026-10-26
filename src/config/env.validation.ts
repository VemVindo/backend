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

export class VariaveisDeAmbiente {
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

  @IsIn(['lax', 'none'])
  @IsOptional()
  COOKIE_SAMESITE?: 'lax' | 'none';

  @IsString()
  @IsOptional()
  GOOGLE_MAPS_SERVER_KEY?: string;
}

export function validarAmbiente(
  ambiente: Record<string, unknown>,
): VariaveisDeAmbiente {
  const variaveis = plainToInstance(VariaveisDeAmbiente, ambiente, {
    enableImplicitConversion: false,
  });
  const erros = validateSync(variaveis, { skipMissingProperties: false });
  if (erros.length > 0) {
    throw new Error(`Configuração de ambiente inválida:\n${erros.toString()}`);
  }
  exigirFrontHttpsEmProducao(variaveis, ambiente.NODE_ENV);
  return variaveis;
}

function exigirFrontHttpsEmProducao(
  variaveis: VariaveisDeAmbiente,
  ambienteDeExecucao: unknown,
): void {
  if (ambienteDeExecucao !== 'production') {
    return;
  }
  const enderecoDoFront = variaveis.URL_FRONTEND ?? variaveis.CORS_ORIGIN;
  if (!enderecoDoFront?.startsWith('https://')) {
    throw new Error(
      'Configuração de ambiente inválida:\nEm produção, URL_FRONTEND (ou CORS_ORIGIN) precisa começar com https://',
    );
  }
}
