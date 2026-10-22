import { MetricasPagamento } from 'src/generated/prisma';
import { PrismaService } from 'src/prisma/prisma.service';

export abstract class Remuneracao {
  idEmpresa: number;
  prisma: PrismaService;
  taxa_fixa: number;
  coeficiente: number;
  data: string;

  public abstract configurar(): Promise<MetricasPagamento | null>;

  constructor(
    idEmpresa: number,
    prisma: PrismaService,
    taxa_fixa: number,
    coefieciente: number,
    data: string,
  ) {
    this.idEmpresa = idEmpresa;
    this.prisma = prisma;
    this.coeficiente = coefieciente;
    this.taxa_fixa = taxa_fixa;
    this.data = data;
  }
}
