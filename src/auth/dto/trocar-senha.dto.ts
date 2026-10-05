import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import {
  TAMANHO_MAXIMO_SENHA_BCRYPT,
  TAMANHO_MINIMO_SENHA,
} from '../../common/security/senha.constants';

export class TrocarSenhaDto {
  @IsString()
  @IsNotEmpty()
  senhaAtual: string;

  @IsString()
  @MinLength(TAMANHO_MINIMO_SENHA)
  @MaxLength(TAMANHO_MAXIMO_SENHA_BCRYPT)
  novaSenha: string;
}
