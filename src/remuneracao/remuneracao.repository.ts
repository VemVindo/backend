import { Injectable } from '@nestjs/common';
import { MetricasPagamento } from 'src/generated/prisma';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class RemuneracaoRepository {
  constructor(private readonly prisma: PrismaService) {}
  async verificaTaxaFixa(idEmpresa: number): Promise<MetricasPagamento | null> {
    return await this.prisma.metricasPagamento.findFirst({
      where: {
        idEmpresa,
      },
    });
  }
}
