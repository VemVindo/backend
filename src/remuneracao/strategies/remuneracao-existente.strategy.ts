import { PrismaService } from 'src/prisma/prisma.service';
import { Remuneracao } from './remuneracao.strategy';

export class RemuneracaoExistente extends Remuneracao {
  public async configurar(): Promise<any> {
    return await this.prisma.metricasPagamento.update({
      where: {
        idEmpresa_data: {
          idEmpresa: this.idEmpresa,
          data: this.data,
        },
      },
      data: {
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
    data: string,
  ) {
    super(idEmpresa, prisma, taxa_fixa, coeficiente, data);
  }
}
