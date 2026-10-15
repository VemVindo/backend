import { IsBoolean } from 'class-validator';

export class AtualizarConfiguracoesDto {
  @IsBoolean({ message: 'exibirMapa deve ser verdadeiro ou falso' })
  exibirMapa: boolean;
}
