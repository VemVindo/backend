import {
  IsIn,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { TipoVeiculo } from '../../common/enums/tipo-veiculo.enum';
import { Trim } from '../../common/transformers/texto.transformer';
import { IsCpf } from '../../common/validators/is-cpf.validator';

const PLACA_ANTIGA_OU_MERCOSUL = /^[A-Z]{3}\d[A-Z0-9]\d{2}$/;

export class CadastrarEntregadorDto {
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nome: string;

  @IsCpf()
  cpf: string;

  @Matches(/^\d{10,11}$/, {
    message: 'telefone deve ter DDD e numero, so digitos (10 ou 11)',
  })
  telefone: string;

  @IsIn(Object.values(TipoVeiculo))
  tipoVeiculo: TipoVeiculo;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value.trim().toUpperCase().replace('-', '')
      : value,
  )
  @ValidateIf(
    (dto: CadastrarEntregadorDto) => dto.tipoVeiculo !== TipoVeiculo.BICICLETA,
  )
  @Matches(PLACA_ANTIGA_OU_MERCOSUL, {
    message: 'placa invalida: use ABC1234 ou ABC1D23',
  })
  placa?: string;
}
