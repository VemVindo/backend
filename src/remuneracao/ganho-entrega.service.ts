import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { Pedido, Prisma } from '../generated/prisma/client';
import { CalculoValorEntregaService } from './calculo-valor-entrega.service';
import { RemuneracaoRepository } from './remuneracao.repository';

@Injectable()
export class GanhoEntregaService {
  constructor(
    private readonly repositorioRemuneracao: RemuneracaoRepository,
    private readonly calculoValorEntrega: CalculoValorEntregaService,
  ) {}

  async capturarParametros(
    clienteTransacional: Prisma.TransactionClient,
    idEmpresa: number,
    agora: Date,
  ) {
    const parametrosRemuneracao =
      await this.repositorioRemuneracao.procurarVigentes(
        idEmpresa,
        agora,
        clienteTransacional,
      );
    if (!parametrosRemuneracao) {
      throw new UnprocessableEntityException(
        'Configure os parâmetros de remuneração da empresa antes de atribuir a entrega',
      );
    }

    this.calculoValorEntrega.calcularValorEntrega({
      distanciaMetros: 0,
      taxaFixaCentavos: parametrosRemuneracao.taxa_fixa,
      coeficienteCentavosKm: parametrosRemuneracao.coeficiente,
    });
    return {
      taxa_fixa_atribuicao_centavos: parametrosRemuneracao.taxa_fixa,
      coeficiente_atribuicao_centavos_km: parametrosRemuneracao.coeficiente,
      parametros_vigentes_desde: parametrosRemuneracao.data,
      remuneracao_atribuida_em: agora,
    };
  }

  consolidarGanho(pedido: Pedido): number {
    if (
      pedido.taxa_fixa_atribuicao_centavos == null ||
      pedido.coeficiente_atribuicao_centavos_km == null ||
      !pedido.parametros_vigentes_desde ||
      !pedido.remuneracao_atribuida_em
    ) {
      throw new UnprocessableEntityException(
        'Entrega sem parâmetros congelados na atribuição; regularize a atribuição antes de finalizar',
      );
    }
    if (pedido.distancia_conhecida !== true) {
      throw new UnprocessableEntityException(
        'Distância da entrega desconhecida; informe uma distância válida antes de finalizar',
      );
    }
    return this.calculoValorEntrega.calcularValorEntrega({
      distanciaMetros: pedido.distancia,
      taxaFixaCentavos: pedido.taxa_fixa_atribuicao_centavos,
      coeficienteCentavosKm: pedido.coeficiente_atribuicao_centavos_km,
    });
  }
}
