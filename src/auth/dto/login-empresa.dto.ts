import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { NormalizarEmail } from '../../common/transformers/texto.transformer';

export class LoginEmpresaDto {
  @NormalizarEmail()
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  senha: string;
}
