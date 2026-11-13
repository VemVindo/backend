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

const PLACA_ANTIGA_OU_MERCOSUL = /^[A-Z]{3}\d[A-Z0-9]\d{2}$/;

// Campo ausente fica como esta. Campo nulo e recusado, porque nao ha como
// apagar nome, telefone ou veiculo; a placa so some ao trocar para bicicleta.
const informado = (_dto: object, valor: unknown) => valor !== undefined;

// O CPF fica de fora: com forbidNonWhitelisted, manda-lo responde 400.
export class EditarPerfilDto {
  @ValidateIf(informado)
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nome?: string;

  @ValidateIf(informado)
  @Matches(/^\d{10,11}$/, {
    message: 'telefone deve ter DDD e numero, so digitos (10 ou 11)',
  })
  telefone?: string;

  @ValidateIf(informado)
  @IsIn(Object.values(TipoVeiculo))
  tipoVeiculo?: TipoVeiculo;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value.trim().toUpperCase().replace('-', '')
      : value,
  )
  @ValidateIf(informado)
  @Matches(PLACA_ANTIGA_OU_MERCOSUL, {
    message: 'placa invalida: use ABC1234 ou ABC1D23',
  })
  placa?: string;
}
