import { Transform } from 'class-transformer';
import { IsDate, IsInt, IsOptional, Max, Min } from 'class-validator';

// Query string: ?notas=1,2&de=2026-10-01T00:00:00Z&ate=2026-10-20T23:59:59Z
export class FiltroAvaliacoesDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .filter((parte) => parte.trim() !== '')
          .map(Number)
      : value,
  )
  @IsInt({ each: true, message: 'notas deve listar inteiros de 0 a 5' })
  @Min(0, { each: true, message: 'notas deve listar inteiros de 0 a 5' })
  @Max(5, { each: true, message: 'notas deve listar inteiros de 0 a 5' })
  notas?: number[];

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? new Date(value) : value,
  )
  @IsDate({ message: 'de deve ser uma data valida' })
  de?: Date;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? new Date(value) : value,
  )
  @IsDate({ message: 'ate deve ser uma data valida' })
  ate?: Date;
}
