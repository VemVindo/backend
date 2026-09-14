import { plainToInstance } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  validateSync,
} from 'class-validator';

export class EnvironmentVariables {
  // Conexao de runtime (pooled no Supabase, Postgres local em dev).
  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  // Conexao direta usada pelas migrations do Prisma.
  @IsString()
  @IsOptional()
  DIRECT_URL?: string;

  @IsString()
  @IsNotEmpty()
  JWT_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRES_IN?: string;

  // Origem permitida para CORS (frontend). Default: http://localhost:3000.
  @IsString()
  @IsOptional()
  CORS_ORIGIN?: string;

  @IsString()
  @IsOptional()
  PORT?: string;
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
  return validated;
}
