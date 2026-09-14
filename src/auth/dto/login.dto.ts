import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginEmpresaDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  senha: string;
}
