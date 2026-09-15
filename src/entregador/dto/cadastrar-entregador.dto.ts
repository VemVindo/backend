import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { TipoVeiculo } from '../../common/enums/tipo-veiculo.enum';

export class CadastrarEntregadorDto {
  @IsString()
  @IsNotEmpty()
  nome: string;

  @IsString()
  @IsNotEmpty()
  cpf: string;

  @IsString()
  @IsNotEmpty()
  telefone: string;

  @IsIn(Object.values(TipoVeiculo))
  tipoVeiculo: TipoVeiculo;

  // Obrigatoria apenas para veiculos motorizados; validada quando aplicavel.
  @IsString()
  @IsOptional()
  placa?: string;
}
