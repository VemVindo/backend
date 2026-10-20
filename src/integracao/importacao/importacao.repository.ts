import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  MetricasPagamento,
  Pedido,
  PedidoImportado,
  Prisma,
} from '../../generated/prisma/client';
import { SituacaoImportacao, StatusPedido } from '../../generated/prisma/enums';
import { DadosPedidoExterno } from './analise-pedido-externo';

export interface DadosNovoPedido {
  nome_recebedor: string;
  telefone_recebedor: string;
  cep: string;
  logradouro: string;
  numero: number;
  complemento: string | null;
  bairro: string;
  cidade: string;
  uf: string;
  descricao: string;
  status: StatusPedido;
  data_criacao: Date;
  valor_entrega: number;
  distancia: number;
}

export class PendenciaJaConvertida extends Error {}

function criarPedido(
  tx: Prisma.TransactionClient,
  idEmpresa: number,
  pedido: DadosNovoPedido,
): Promise<Pedido> {
  return tx.pedido.create({ data: { ...pedido, idEmpresa } });
}

@Injectable()
export class ImportacaoRepository {
  constructor(private readonly prisma: PrismaService) {}

  procurarPorIdExterno(
    idEmpresa: number,
    idExterno: string,
  ): Promise<PedidoImportado | null> {
    return this.prisma.pedidoImportado.findUnique({
      where: { idEmpresa_id_externo: { idEmpresa, id_externo: idExterno } },
    });
  }

  procurarMetricasVigentes(
    idEmpresa: number,
    agora: Date,
  ): Promise<MetricasPagamento | null> {
    return this.prisma.metricasPagamento.findFirst({
      where: { idEmpresa, data: { lte: agora } },
      orderBy: { data: 'desc' },
    });
  }

  criarPendencia(
    idEmpresa: number,
    idExterno: string,
    dados: DadosPedidoExterno,
    camposFaltantes: string[],
  ): Promise<PedidoImportado> {
    return this.prisma.pedidoImportado.create({
      data: {
        idEmpresa,
        id_externo: idExterno,
        dados,
        campos_faltantes: camposFaltantes,
      },
    });
  }

  criarPedidoImportado(
    idEmpresa: number,
    idExterno: string,
    dados: DadosPedidoExterno,
    pedido: DadosNovoPedido,
  ): Promise<Pedido> {
    return this.prisma.$transaction(async (tx) => {
      const criado = await criarPedido(tx, idEmpresa, pedido);
      await tx.pedidoImportado.create({
        data: {
          idEmpresa,
          id_externo: idExterno,
          dados,
          campos_faltantes: [],
          situacao: SituacaoImportacao.CONVERTIDO,
          idPedido: criado.id_pedido,
        },
      });
      return criado;
    });
  }

  listarPendencias(idEmpresa: number): Promise<PedidoImportado[]> {
    return this.prisma.pedidoImportado.findMany({
      where: { idEmpresa, situacao: SituacaoImportacao.AGUARDANDO_COMPLETUDE },
      orderBy: { data_recebimento: 'asc' },
    });
  }

  procurarPendencia(
    idImportacao: number,
    idEmpresa: number,
  ): Promise<PedidoImportado | null> {
    return this.prisma.pedidoImportado.findFirst({
      where: {
        id_importacao: idImportacao,
        idEmpresa,
        situacao: SituacaoImportacao.AGUARDANDO_COMPLETUDE,
      },
    });
  }

  atualizarPendencia(
    idImportacao: number,
    dados: DadosPedidoExterno,
    camposFaltantes: string[],
  ): Promise<PedidoImportado> {
    return this.prisma.pedidoImportado.update({
      where: { id_importacao: idImportacao },
      data: { dados, campos_faltantes: camposFaltantes },
    });
  }

  converterPendencia(
    idImportacao: number,
    idEmpresa: number,
    dados: DadosPedidoExterno,
    pedido: DadosNovoPedido,
  ): Promise<Pedido> {
    return this.prisma.$transaction(async (tx) => {
      const criado = await criarPedido(tx, idEmpresa, pedido);
      const { count } = await tx.pedidoImportado.updateMany({
        where: {
          id_importacao: idImportacao,
          idEmpresa,
          situacao: SituacaoImportacao.AGUARDANDO_COMPLETUDE,
        },
        data: {
          dados,
          campos_faltantes: [],
          situacao: SituacaoImportacao.CONVERTIDO,
          idPedido: criado.id_pedido,
        },
      });
      if (count === 0) {
        throw new PendenciaJaConvertida();
      }
      return criado;
    });
  }
}
