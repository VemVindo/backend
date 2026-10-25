import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StatusPedido } from '../generated/prisma/enums';
import { LocalizacaoService } from '../mapa/localizacao.service';
import { PedidoAlteradoError } from '../pedido/pedido.erros';
import {
  RemocaoDaFrotaRepository,
  ResultadoDaRemocao,
} from './remocao-da-frota.repository';

@Injectable()
export class RemocaoDaFrotaService {
  constructor(
    private readonly remocao: RemocaoDaFrotaRepository,
    private readonly localizacao: LocalizacaoService,
  ) {}

  async desvincular(
    idEmpresa: number,
    cpf: string,
  ): Promise<ResultadoDaRemocao> {
    let resultado: ResultadoDaRemocao | null;
    try {
      resultado = await this.remocao.remover(idEmpresa, cpf);
    } catch (erro) {
      if (erro instanceof PedidoAlteradoError) {
        throw new ConflictException(
          'Um pedido do entregador mudou durante a remocao; tente novamente',
        );
      }
      throw erro;
    }
    if (!resultado) {
      throw new NotFoundException('Entregador nao esta na sua frota');
    }

    for (const { idPedido } of resultado.reatribuidos) {
      await this.localizacao.aoTrocarEntregador(idPedido);
    }
    for (const { idPedido } of resultado.pendentes) {
      await this.localizacao.aoTrocarEntregador(idPedido);
      await this.localizacao.aoMudarStatus(idPedido, StatusPedido.PENDENTE);
    }
    return resultado;
  }
}
