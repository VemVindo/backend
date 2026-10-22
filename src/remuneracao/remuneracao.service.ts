import { ConflictException, Injectable } from '@nestjs/common';
import { MetricasPagamento } from '../generated/prisma/client';
import { violouUnicidade } from '../prisma/prisma-errors';
import {
  NovosParametros,
  RemuneracaoRepository,
} from './remuneracao.repository';

// Valores em centavos: taxa por entrega e adicional por quilometro.
export interface ParametrosRemuneracao {
  taxaFixa: number | null;
  coeficienteKm: number | null;
  vigenteDesde: Date | null;
}

const SEM_PARAMETROS: ParametrosRemuneracao = {
  taxaFixa: null,
  coeficienteKm: null,
  vigenteDesde: null,
};

@Injectable()
export class RemuneracaoService {
  constructor(private readonly remuneracoes: RemuneracaoRepository) {}

  async consultar(
    idEmpresa: number,
    agora = new Date(),
  ): Promise<ParametrosRemuneracao> {
    const vigentes = await this.remuneracoes.procurarVigentes(idEmpresa, agora);
    return vigentes ? paraParametros(vigentes) : SEM_PARAMETROS;
  }

  // E-US15: os novos valores valem a partir de agora; entregas ja calculadas
  // mantem o valor que tinham.
  async salvar(
    idEmpresa: number,
    parametros: NovosParametros,
    agora = new Date(),
  ): Promise<ParametrosRemuneracao> {
    try {
      const salvos = await this.remuneracoes.registrar(
        idEmpresa,
        parametros,
        agora,
      );
      return paraParametros(salvos);
    } catch (erro) {
      if (violouUnicidade(erro)) {
        throw new ConflictException(
          'Os parâmetros acabaram de ser alterados; tente de novo',
        );
      }
      throw erro;
    }
  }
}

function paraParametros(metricas: MetricasPagamento): ParametrosRemuneracao {
  return {
    taxaFixa: metricas.taxa_fixa,
    coeficienteKm: metricas.coeficiente,
    vigenteDesde: metricas.data,
  };
}
