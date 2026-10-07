import { IsCpf } from '../../common/validators/is-cpf.validator';

export class CpfParamDto {
  @IsCpf()
  cpf: string;
}
