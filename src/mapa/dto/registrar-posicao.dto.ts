import { IsNumber, IsOptional, Max, Min } from 'class-validator';

export class RegistrarPosicaoDto {
  @IsNumber({}, { message: 'Latitude inválida' })
  @Min(-90, { message: 'Latitude inválida' })
  @Max(90, { message: 'Latitude inválida' })
  lat: number;

  @IsNumber({}, { message: 'Longitude inválida' })
  @Min(-180, { message: 'Longitude inválida' })
  @Max(180, { message: 'Longitude inválida' })
  lng: number;

  // Raio de incerteza informado pelo navegador, em metros.
  @IsOptional()
  @IsNumber({}, { message: 'Precisão inválida' })
  @Min(0, { message: 'Precisão inválida' })
  precisao?: number;
}
