import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RepositorioDesempenhoEntregador } from './desempenho-entregador.repository';
import { DesempenhoEntregadorDto } from './dto/desempenho-entregador.dto';
import { FiltroDesempenhoDto } from './dto/filtro-desempenho.dto';

@Injectable()
export class ServicoDesempenhoEntregador {
  constructor(
    private readonly repositorio_desempenho: RepositorioDesempenhoEntregador,
  ) {}

  async consultar_desempenho(
    id_empresa: number,
    cpf_entregador: string,
    filtro_periodo: FiltroDesempenhoDto,
  ): Promise<DesempenhoEntregadorDto> {
    const data_inicio_periodo = new Date(filtro_periodo.de);
    const data_fim_periodo = new Date(filtro_periodo.ate);
    if (
      !Number.isFinite(data_inicio_periodo.getTime()) ||
      !Number.isFinite(data_fim_periodo.getTime()) ||
      data_inicio_periodo >= data_fim_periodo
    ) {
      throw new BadRequestException('de deve ser anterior a ate');
    }
    const indicadores_desempenho =
      await this.repositorio_desempenho.agregar_desempenho(
        id_empresa,
        cpf_entregador,
        data_inicio_periodo,
        data_fim_periodo,
      );
    if (!indicadores_desempenho) {
      throw new NotFoundException(
        'Entregador nao encontrado na frota da empresa',
      );
    }
    return {
      cpf_entregador,
      periodo: {
        de: data_inicio_periodo.toISOString(),
        ate: data_fim_periodo.toISOString(),
      },
      ...indicadores_desempenho,
    };
  }
}
