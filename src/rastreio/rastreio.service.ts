import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  montarLinkWhatsapp,
  textoDoRecebedorParaEmpresa,
} from '../pedido/whatsapp';
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
    private readonly configuracao: ConfigService,
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
    this.gateway.revogarLink(idPedido);
    return novo;
  }

  montarPaginaDoRecebedor(acesso: AcessoComPedido) {
    const { pedido } = acesso;
    return {
      estabelecimento: pedido.empresa.nome_fantasia,
      exibirMapa: pedido.empresa.exibir_mapa,
      pedido: dadosDoPedido(pedido),
      entregador: primeiroNome(pedido.entregador?.nome),
      codigoRecebedor: acesso.codigo_recebedor,
      whatsappEstabelecimento: conversaComEstabelecimento(pedido),
      linhaDoTempo: linhaDoTempo(pedido),
    };
  }

  private montarLink(token: string): string {
    const base =
      this.configuracao.get<string>('URL_FRONTEND') ??
      this.configuracao.get<string>('CORS_ORIGIN') ??
      'http://localhost:3000';
    return `${base.replace(/\/+$/, '')}/rastreio/${token}`;
  }
}

type PedidoDoAcesso = AcessoComPedido['pedido'];

function dadosDoPedido(pedido: PedidoDoAcesso) {
  return {
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
  };
}

function primeiroNome(nomeCompleto: string | undefined): string | null {
  return nomeCompleto?.trim().split(/\s+/)[0] ?? null;
}

function conversaComEstabelecimento(pedido: PedidoDoAcesso): string | null {
  if (STATUS_DE_ENTREGA_ENCERRADA.includes(pedido.status)) {
    return null;
  }
  return montarLinkWhatsapp(
    pedido.empresa.telefone,
    textoDoRecebedorParaEmpresa({
      idPedido: pedido.id_pedido,
      empresa: pedido.empresa.nome_fantasia,
      recebedor: pedido.nome_recebedor,
    }),
  );
}
