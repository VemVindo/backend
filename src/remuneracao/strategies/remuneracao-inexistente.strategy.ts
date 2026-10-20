import { PrismaService } from 'src/prisma/prisma.service';
import { Remuneracao } from './remuneracao.strategy';

export class RemuneracaoInexistente extends Remuneracao {
  public async configurar(): Promise<any> {
    return await this.prisma.metricasPagamento.create({
      data: {
        idEmpresa: this.idEmpresa,
        taxa_fixa: this.taxa_fixa,
        coeficiente: this.coeficiente,
        data: this.data,
      },
    });
  }

  constructor(
    idEmpresa: number,
    prisma: PrismaService,
    taxa_fixa: number,
    coeficiente: number,
  ) {
    const data = new Date();
    const dataString = data.toISOString();
    super(idEmpresa, prisma, taxa_fixa, coeficiente, dataString);
  }
}
