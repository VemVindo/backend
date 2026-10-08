import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AcessoComPedido, RastreioRepository } from './rastreio.repository';
import {
  gerarCodigoRecebedor,
  gerarTokenRastreio,
  hashDoToken,
  tokenComFormatoValido,
} from './token-rastreio';

export const STATUS_DE_ENTREGA_ENCERRADA: readonly string[] = [
  'FINALIZADO',
  'CANCELADO',
];

export type ResultadoAcesso =
  | { situacao: 'valido'; acesso: AcessoComPedido }
  | { situacao: 'encerrado' }
  | { situacao: 'invalido' };

@Injectable()
export class RastreioService {
  constructor(
    private readonly rastreio: RastreioRepository,
    private readonly config: ConfigService,
  ) {}

  async criarAcesso(idPedido: number) {
    const token = gerarTokenRastreio();
    const acesso = await this.rastreio.salvarAcesso(
      idPedido,
      hashDoToken(token),
      gerarCodigoRecebedor(),
    );
    return {
      link: this.montarLink(token),
      codigoRecebedor: acesso.codigo_recebedor,
    };
  }

  async gerarNovoLink(idEmpresa: number, idPedido: number) {
    const pedido = await this.rastreio.procurarPedidoDaEmpresa(
      idPedido,
      idEmpresa,
    );
    if (!pedido) {
      throw new NotFoundException('Pedido nao encontrado');
    }
    if (STATUS_DE_ENTREGA_ENCERRADA.includes(pedido.status)) {
      throw new ConflictException(
        'Pedido encerrado: o rastreio nao fica mais disponivel',
      );
    }
    return this.criarAcesso(idPedido);
  }

  async autenticar(token: string): Promise<ResultadoAcesso> {
    if (!tokenComFormatoValido(token)) {
      return { situacao: 'invalido' };
    }
    const acesso = await this.rastreio.procurarPorTokenHash(hashDoToken(token));
    if (!acesso) {
      return { situacao: 'invalido' };
    }
    if (STATUS_DE_ENTREGA_ENCERRADA.includes(acesso.pedido.status)) {
      return { situacao: 'encerrado' };
    }
    return { situacao: 'valido', acesso };
  }

  montarPaginaDoRecebedor(acesso: AcessoComPedido) {
    const { pedido } = acesso;
    return {
      estabelecimento: pedido.empresa.nome_fantasia,
      pedido: {
        numero: pedido.id_pedido,
        descricao: pedido.descricao,
        recebedor: pedido.nome_recebedor,
        status: pedido.status,
        criadoEm: pedido.data_criacao,
        endereco: {
          logradouro: pedido.logradouro,
          numero: pedido.numero,
          complemento: pedido.complemento,
          bairro: pedido.bairro,
          cidade: pedido.cidade,
          uf: pedido.uf,
          cep: pedido.cep,
        },
      },
      codigoRecebedor: acesso.codigo_recebedor,
    };
  }

  private montarLink(token: string): string {
    const base =
      this.config.get<string>('URL_FRONTEND') ??
      this.config.get<string>('CORS_ORIGIN') ??
      'http://localhost:3000';
    return `${base.replace(/\/+$/, '')}/rastreio/${token}`;
  }
}
