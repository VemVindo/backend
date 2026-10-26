import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class EditarEntregadorDto {
  @IsString()
  @IsOptional()
  nome?: string | null;

  @IsString()
  @IsOptional()
  telefone?: string | null;

  @IsString()
  @IsOptional()
  veiculo?: string | null;

  @IsString()
  @IsOptional()
  placa?: string | null;

  @IsString()
  @IsNotEmpty()
  cpf!: string;
}
