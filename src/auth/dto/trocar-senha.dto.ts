import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  CARACTERES_PERMITIDOS_SENHA,
  MENSAGEM_CARACTERES_SENHA,
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
  @Matches(CARACTERES_PERMITIDOS_SENHA, { message: MENSAGEM_CARACTERES_SENHA })
  novaSenha: string;

  @IsOptional()
  @IsBoolean()
  cienteDadosCompartilhados?: boolean;
}
