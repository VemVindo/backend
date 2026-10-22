import {
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Trim } from '../../common/transformers/texto.transformer';

export const TAMANHO_MAXIMO_COMENTARIO = 500;

export class AvaliarDto {
  @IsInt({ message: 'nota deve ser um numero inteiro' })
  @Min(0, { message: 'nota deve ser de 0 a 5' })
  @Max(5, { message: 'nota deve ser de 0 a 5' })
  nota: number;
}

export class ComentarDto {
  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'escreva o comentario' })
  @MaxLength(TAMANHO_MAXIMO_COMENTARIO, {
    message: `o comentario aceita ate ${TAMANHO_MAXIMO_COMENTARIO} caracteres`,
  })
  comentario: string;
}
