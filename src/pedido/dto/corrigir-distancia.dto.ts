import { IsInt, Max, Min } from 'class-validator';

const DISTANCIA_MAXIMA_METROS = 2_147_483_647;

export class CorrigirDistanciaDto {
  @IsInt()
  @Min(0)
  @Max(DISTANCIA_MAXIMA_METROS)
  distanciaMetros!: number;
}
