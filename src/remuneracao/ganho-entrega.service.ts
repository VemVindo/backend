import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { Pedido, Prisma } from '../generated/prisma/client';
import { CalculoValorEntregaService } from './calculo-valor-entrega.service';
import { RemuneracaoRepository } from './remuneracao.repository';

@Injectable()
export class GanhoEntregaService {
  constructor(
    private readonly repositorio_remuneracao: RemuneracaoRepository,
    private readonly calculo_valor_entrega: CalculoValorEntregaService,
  ) {}

  async capturar_parametros(
    cliente_transacional: Prisma.TransactionClient,
    id_empresa: number,
    agora: Date,
  ) {
    const parametros_remuneracao =
      await this.repositorio_remuneracao.procurarVigentes(
        id_empresa,
        agora,
        cliente_transacional,
      );
    if (!parametros_remuneracao) {
      throw new UnprocessableEntityException(
        'Configure os parâmetros de remuneração da empresa antes de atribuir a entrega',
      );
    }

    this.calculo_valor_entrega.calcular_valor_entrega({
      distancia_metros: 0,
      taxa_fixa_centavos: parametros_remuneracao.taxa_fixa,
      coeficiente_centavos_km: parametros_remuneracao.coeficiente,
    });
    return {
      taxa_fixa_atribuicao_centavos: parametros_remuneracao.taxa_fixa,
      coeficiente_atribuicao_centavos_km: parametros_remuneracao.coeficiente,
      parametros_vigentes_desde: parametros_remuneracao.data,
      remuneracao_atribuida_em: agora,
    };
  }

  consolidar_ganho(pedido: Pedido): number {
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
    return this.calculo_valor_entrega.calcular_valor_entrega({
      distancia_metros: pedido.distancia,
      taxa_fixa_centavos: pedido.taxa_fixa_atribuicao_centavos,
      coeficiente_centavos_km: pedido.coeficiente_atribuicao_centavos_km,
    });
  }
}
