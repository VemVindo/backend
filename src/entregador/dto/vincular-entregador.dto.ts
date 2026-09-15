import { IsNotEmpty, IsString } from 'class-validator';

export class VincularEntregadorDto {
  @IsString()
  @IsNotEmpty()
  cpf: string;
}
