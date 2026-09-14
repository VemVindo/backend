import { IsNotEmpty, IsString } from 'class-validator';

export class LoginEntregadorDto {
  @IsString()
  @IsNotEmpty()
  cpf: string;

  @IsString()
  @IsNotEmpty()
  senha: string;
}
