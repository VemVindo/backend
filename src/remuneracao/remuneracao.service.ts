import { Injectable } from '@nestjs/common';
import { ConfigurarRemuneracaoReqDto } from './dto/configurar-remuneracao.dto';
import { RemuneracaoFactory } from './factories/remuneracao.factory';

@Injectable()
export class RemuneracaoService {
  constructor(private readonly remuneracaoFactory: RemuneracaoFactory) {}

  public async configurarTaxaFixa(
    idEmpresa: number,
    configurarRemuneracaoDto: ConfigurarRemuneracaoReqDto,
  ): Promise<boolean> {
    const { taxa_fixa, coeficiente } = configurarRemuneracaoDto;
    if (!taxa_fixa && !coeficiente) return false;
    const configuracao = await this.remuneracaoFactory.criar(
      idEmpresa,
      taxa_fixa,
      coeficiente,
    );
    if (await configuracao.configurar()) return true;
    else return false;
  }
}
