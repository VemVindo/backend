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

  procurarVigentes(
    idEmpresa: number,
    agora: Date,
    clienteTransacional: Prisma.TransactionClient = this.prisma,
  ): Promise<MetricasPagamento | null> {
    return clienteTransacional.metricasPagamento.findFirst({
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
