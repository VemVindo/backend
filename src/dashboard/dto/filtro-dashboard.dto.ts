import { Transform } from 'class-transformer';
import { IsDate, IsOptional } from 'class-validator';

const ConverterParaData = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? new Date(value) : value,
  );

export class FiltroDashboardDto {
  @IsOptional()
  @ConverterParaData()
  @IsDate({ message: 'dataInicio deve ser uma data valida' })
  dataInicio?: Date;

  @IsOptional()
  @ConverterParaData()
  @IsDate({ message: 'dataFinal deve ser uma data valida' })
  dataFinal?: Date;
}
