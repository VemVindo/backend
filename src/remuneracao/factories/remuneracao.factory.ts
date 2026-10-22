import { PrismaService } from '../../prisma/prisma.service';
import { RemuneracaoRepository } from '../remuneracao.repository';
import { RemuneracaoExistente } from '../strategies/remuneracao-existente.strategy';
import { RemuneracaoInexistente } from '../strategies/remuneracao-inexistente.strategy';
import { Remuneracao } from '../strategies/remuneracao.strategy';
import { Injectable } from '@nestjs/common';

@Injectable()
export class RemuneracaoFactory {
  constructor(
    private readonly prisma: PrismaService,
    private readonly remuneracaoRepository: RemuneracaoRepository,
  ) {}

  public async criar(
    idEmpresa: number,
    taxa_fixa: number,
    coeficiente: number,
  ): Promise<Remuneracao> {
    const result =
      await this.remuneracaoRepository.verificaRemuneracao(idEmpresa);
    if (result)
      return new RemuneracaoExistente(
        idEmpresa,
        this.prisma,
        taxa_fixa,
        coeficiente,
        result.data.toISOString(),
      );
    else
      return new RemuneracaoInexistente(
        idEmpresa,
        this.prisma,
        taxa_fixa,
        coeficiente,
      );
  }
}
