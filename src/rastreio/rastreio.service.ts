import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { montarLinkWhatsapp, textoDoRecebedor } from '../pedido/whatsapp';
import { RastreioGateway } from './rastreio.gateway';
import { AcessoComPedido, RastreioRepository } from './rastreio.repository';
import {
  gerarCodigoRecebedor,
  gerarTokenRastreio,
  hashDoToken,
} from './token-rastreio';
import { STATUS_DE_ENTREGA_ENCERRADA } from './validador-de-link';
import { linhaDoTempo } from './linha-do-tempo';

@Injectable()
export class RastreioService {
  constructor(
    private readonly rastreio: RastreioRepository,
    private readonly config: ConfigService,
    private readonly gateway: RastreioGateway,
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
    const novo = await this.criarAcesso(idPedido);
    // O link anterior deixa de valer, inclusive para quem ja estava com ele
    // aberto: se vazou, para de mostrar a localizacao na hora.
    this.gateway.revogarLink(idPedido);
    return novo;
  }

  montarPaginaDoRecebedor(acesso: AcessoComPedido) {
    const { pedido } = acesso;
    return {
      estabelecimento: pedido.empresa.nome_fantasia,
      exibirMapa: pedido.empresa.exibir_mapa,
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
      // So o primeiro nome: o recebedor nao precisa do nome completo.
      entregador: pedido.entregador?.nome.trim().split(/\s+/)[0] ?? null,
      codigoRecebedor: acesso.codigo_recebedor,
      whatsappEstabelecimento: STATUS_DE_ENTREGA_ENCERRADA.includes(
        pedido.status,
      )
        ? null
        : montarLinkWhatsapp(
            pedido.empresa.telefone,
            textoDoRecebedor({
              idPedido: pedido.id_pedido,
              empresa: pedido.empresa.nome_fantasia,
              recebedor: pedido.nome_recebedor,
            }),
          ),
      linhaDoTempo: linhaDoTempo(pedido),
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
