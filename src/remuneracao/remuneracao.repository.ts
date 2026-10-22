import { Injectable } from '@nestjs/common';
import { MetricasPagamento } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RemuneracaoRepository {
  constructor(private readonly prisma: PrismaService) {}
  async verificaRemuneracao(
    idEmpresa: number,
  ): Promise<MetricasPagamento | null> {
    return await this.prisma.metricasPagamento.findFirst({
      where: {
        idEmpresa,
      },
    });
  }
}
