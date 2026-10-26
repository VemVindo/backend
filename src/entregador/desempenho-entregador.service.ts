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
    private readonly repositorioDesempenho: RepositorioDesempenhoEntregador,
  ) {}

  async consultarDesempenho(
    idEmpresa: number,
    cpfEntregador: string,
    filtroPeriodo: FiltroDesempenhoDto,
  ): Promise<DesempenhoEntregadorDto> {
    const dataInicioPeriodo = new Date(filtroPeriodo.de);
    const dataFimPeriodo = new Date(filtroPeriodo.ate);
    if (
      !Number.isFinite(dataInicioPeriodo.getTime()) ||
      !Number.isFinite(dataFimPeriodo.getTime()) ||
      dataInicioPeriodo >= dataFimPeriodo
    ) {
      throw new BadRequestException('de deve ser anterior a ate');
    }
    const indicadoresDesempenho =
      await this.repositorioDesempenho.agregarDesempenho(
        idEmpresa,
        cpfEntregador,
        dataInicioPeriodo,
        dataFimPeriodo,
      );
    if (!indicadoresDesempenho) {
      throw new NotFoundException(
        'Entregador nao encontrado na frota da empresa',
      );
    }
    return {
      cpf_entregador: cpfEntregador,
      periodo: {
        de: dataInicioPeriodo.toISOString(),
        ate: dataFimPeriodo.toISOString(),
      },
      ...indicadoresDesempenho,
    };
  }
}
