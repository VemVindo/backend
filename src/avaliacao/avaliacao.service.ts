import { ConflictException, GoneException, Injectable } from '@nestjs/common';
import { Avaliacao } from '../generated/prisma/client';
import { StatusPedido } from '../generated/prisma/enums';
import { violouUnicidade } from '../prisma/prisma-errors';
import type { AcessoComPedido } from '../rastreio/rastreio.repository';
import {
  AvaliacaoRepository,
  FiltroDeAvaliacoes,
} from './avaliacao.repository';

// O recebedor tem esse prazo, contado da finalizacao, para avaliar.
export const PRAZO_PARA_AVALIAR_MS = 7 * 24 * 60 * 60 * 1000;

export type SituacaoDaAvaliacao =
  'aguardando' | 'disponivel' | 'avaliado' | 'expirada' | 'indisponivel';

export interface AvaliacaoDoRecebedor {
  situacao: SituacaoDaAvaliacao;
  avaliacao: { nota: number; comentario: string | null; data: Date } | null;
}

export interface AvaliacaoNaLista {
  idPedido: number;
  nota: number;
  comentario: string | null;
  data: Date;
  entregador: string | null;
}

@Injectable()
export class AvaliacaoService {
  constructor(private readonly avaliacoes: AvaliacaoRepository) {}

  async consultar(
    acesso: AcessoComPedido,
    agora = new Date(),
  ): Promise<AvaliacaoDoRecebedor> {
    const avaliacao = await this.avaliacoes.procurar(acesso.idPedido);
    return {
      situacao: situacao(acesso, avaliacao, agora),
      avaliacao: avaliacao && paraAvaliacaoDoRecebedor(avaliacao),
    };
  }

  // R-US05: uma nota por pedido, so depois da entrega finalizada.
  async avaliar(
    acesso: AcessoComPedido,
    nota: number,
    agora = new Date(),
  ): Promise<AvaliacaoDoRecebedor> {
    const existente = await this.avaliacoes.procurar(acesso.idPedido);
    exigirDisponivel(situacao(acesso, existente, agora));
    try {
      const avaliacao = await this.avaliacoes.criar(
        acesso.idPedido,
        nota,
        agora,
      );
      return {
        situacao: 'avaliado',
        avaliacao: paraAvaliacaoDoRecebedor(avaliacao),
      };
    } catch (erro) {
      if (violouUnicidade(erro)) {
        throw new ConflictException('Esta entrega já foi avaliada');
      }
      throw erro;
    }
  }

  // R-US06: o comentario vem depois da nota, uma vez so.
  async comentar(
    acesso: AcessoComPedido,
    comentario: string,
    agora = new Date(),
  ): Promise<AvaliacaoDoRecebedor> {
    const avaliacao = await this.avaliacoes.procurar(acesso.idPedido);
    if (!avaliacao) {
      throw new ConflictException('Envie a nota antes do comentário');
    }
    if (prazoEsgotado(acesso, agora)) {
      throw new GoneException('O prazo para avaliar esta entrega terminou');
    }
    const gravou = await this.avaliacoes.registrarComentario(
      acesso.idPedido,
      comentario,
    );
    if (!gravou) {
      throw new ConflictException('O comentário desta entrega já foi enviado');
    }
    return {
      situacao: 'avaliado',
      avaliacao: { ...paraAvaliacaoDoRecebedor(avaliacao), comentario },
    };
  }

  // E-US17: da mais recente para a mais antiga, so da propria empresa.
  async listarDaEmpresa(
    idEmpresa: number,
    filtro: FiltroDeAvaliacoes,
  ): Promise<AvaliacaoNaLista[]> {
    const avaliacoes = await this.avaliacoes.listarDaEmpresa(idEmpresa, filtro);
    return avaliacoes.map((avaliacao) => ({
      idPedido: avaliacao.pedido.id_pedido,
      nota: avaliacao.avaliacao_entrega,
      comentario: avaliacao.comentario,
      data: avaliacao.data,
      entregador: avaliacao.pedido.entregador?.nome ?? null,
    }));
  }
}

function prazoEsgotado(acesso: AcessoComPedido, agora: Date): boolean {
  const fim = acesso.pedido.data_finalizacao;
  return !fim || agora.getTime() - fim.getTime() > PRAZO_PARA_AVALIAR_MS;
}

function situacao(
  acesso: AcessoComPedido,
  avaliacao: Avaliacao | null,
  agora: Date,
): SituacaoDaAvaliacao {
  const { status } = acesso.pedido;
  if (status === StatusPedido.CANCELADO) return 'indisponivel';
  if (status !== StatusPedido.FINALIZADO) return 'aguardando';
  if (avaliacao) return 'avaliado';
  return prazoEsgotado(acesso, agora) ? 'expirada' : 'disponivel';
}

function exigirDisponivel(atual: SituacaoDaAvaliacao): void {
  switch (atual) {
    case 'disponivel':
      return;
    case 'avaliado':
      throw new ConflictException('Esta entrega já foi avaliada');
    case 'aguardando':
      throw new ConflictException(
        'A avaliação abre quando a entrega for finalizada',
      );
    case 'expirada':
      throw new GoneException('O prazo para avaliar esta entrega terminou');
    case 'indisponivel':
      throw new GoneException('Entrega cancelada não pode ser avaliada');
  }
}

function paraAvaliacaoDoRecebedor(avaliacao: Avaliacao) {
  return {
    nota: avaliacao.avaliacao_entrega,
    comentario: avaliacao.comentario,
    data: avaliacao.data,
  };
}
