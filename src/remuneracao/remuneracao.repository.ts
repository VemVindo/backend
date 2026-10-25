import { Injectable } from '@nestjs/common';
import { MetricasPagamento, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface NovosParametros {
  taxaFixa: number;
  coeficienteKm: number;
}

@Injectable()
export class RemuneracaoRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Os parametros nunca sao sobrescritos: cada alteracao vira uma linha nova,
  // e a vigente e a mais recente que ja comecou a valer.
  procurarVigentes(
    idEmpresa: number,
    agora: Date,
    cliente_transacional: Prisma.TransactionClient = this.prisma,
  ): Promise<MetricasPagamento | null> {
    return cliente_transacional.metricasPagamento.findFirst({
      where: { idEmpresa, data: { lte: agora } },
      orderBy: { data: 'desc' },
    });
  }

  registrar(
    idEmpresa: number,
    parametros: NovosParametros,
    vigenteDesde: Date,
  ): Promise<MetricasPagamento> {
    return this.prisma.metricasPagamento.create({
      data: {
        idEmpresa,
        taxa_fixa: parametros.taxaFixa,
        coeficiente: parametros.coeficienteKm,
        data: vigenteDesde,
      },
    });
  }
}
