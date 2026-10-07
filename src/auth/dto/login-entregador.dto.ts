import { IsNotEmpty, IsString } from 'class-validator';
import { IsCpf } from '../../common/validators/is-cpf.validator';

export class LoginEntregadorDto {
  @IsCpf()
  cpf: string;

  @IsString()
  @IsNotEmpty()
  senha: string;
}
