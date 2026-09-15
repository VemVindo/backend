import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class TrocarSenhaDto {
  @IsString()
  @IsNotEmpty()
  senhaAtual: string;

  @IsString()
  @MinLength(8)
  novaSenha: string;
}
