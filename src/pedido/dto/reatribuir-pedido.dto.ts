import { IsCpf } from '../../common/validators/is-cpf.validator';

export class ReatribuirPedidoDto {
  @IsCpf()
  cpfEntregador: string;
}