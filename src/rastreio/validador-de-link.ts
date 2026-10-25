import { Injectable } from '@nestjs/common';
import { AcessoComPedido, RastreioRepository } from './rastreio.repository';
import { hashDoToken, tokenComFormatoValido } from './token-rastreio';

export const STATUS_DE_ENTREGA_ENCERRADA: readonly string[] = [
  'FINALIZADO',
  'CANCELADO',
];

export type ResultadoAcesso =
  | { situacao: 'valido'; acesso: AcessoComPedido }
  | { situacao: 'encerrado' }
  | { situacao: 'invalido' };

@Injectable()
export class ValidadorDeLink {
  constructor(private readonly rastreio: RastreioRepository) {}

  async autenticar(token: string): Promise<ResultadoAcesso> {
    const acesso = await this.procurarAcesso(token);
    if (!acesso) {
      return { situacao: 'invalido' };
    }
    if (STATUS_DE_ENTREGA_ENCERRADA.includes(acesso.pedido.status)) {
      return { situacao: 'encerrado' };
    }
    return { situacao: 'valido', acesso };
  }

  async procurarAcesso(token: string): Promise<AcessoComPedido | null> {
    if (!tokenComFormatoValido(token)) {
      return null;
    }
    return this.rastreio.procurarPorTokenHash(hashDoToken(token));
  }
}
