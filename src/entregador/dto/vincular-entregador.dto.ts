import { IsCpf } from '../../common/validators/is-cpf.validator';

export class VincularEntregadorDto {
  @IsCpf()
  cpf: string;
}
