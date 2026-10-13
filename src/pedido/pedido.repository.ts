import { Injectable } from '@nestjs/common';
import { StatusPedido } from '../common/enums/status-pedido.enum';
import { Pedido } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CriaPedidoReqDto } from './dto/cria-pedido.dto';

@Injectable()
export class PedidoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async criar(pedido: CriaPedidoReqDto): Promise<Pedido> {
    return await this.prisma.pedido.create({
      data: {
        nome_recebedor: pedido.nome_recebedor,
        telefone_recebedor: pedido.telefone_recebedor,
        cep: pedido.cep,
        logradouro: pedido.logradouro,
        numero: pedido.numero,
        complemento: pedido.complemento,
        bairro: pedido.bairro,
        cidade: pedido.cidade,
        uf: pedido.uf,
        descricao: pedido.descricao,
        status: pedido.status,
        data_criacao: pedido.data_criacao,
        valor_entrega: pedido.valor_entrega,
        idEmpresa: pedido.idEmpresa,
        distancia: pedido.distancia,
        cpf_entregador: pedido.cpf_entregador,
      },
    });
  }

  procurarPorEmpresa(
    idPedido: number,
    idEmpresa: number,
  ): Promise<Pedido | null> {
    return this.prisma.pedido.findFirst({
      where: {
        id_pedido: idPedido,
        idEmpresa,
      },
    });
  }

  procurarAtribuidoAoEntregador(
    idPedido: number,
    cpfEntregador: string,
  ): Promise<Pedido | null> {
    return this.prisma.pedido.findFirst({
      where: {
        id_pedido: idPedido,
        cpf_entregador: cpfEntregador,
      },
    });
  }

  atualizarStatus(
    idPedido: number,
    novoStatus: StatusPedido,
  ): Promise<Pedido> {
    return this.prisma.pedido.update({
      where: {
        id_pedido: idPedido,
      },
      data: {
        status: novoStatus,
      },
    });
  }

  reatribuir(
    idPedido: number,
    cpfEntregadorAnterior: string,
    cpfNovoEntregador: string,
  ): Promise<Pedido & { entregador: { nome: string } | null }> {
    return this.prisma.$transaction(async (tx) => {
      await tx.historicoPedidoEntregadores.create({
        data: {
          id_pedido: idPedido,
          cpf_entregador_antigo: cpfEntregadorAnterior,
          cpf_entregador_novo: cpfNovoEntregador,
          data: new Date(),
        },
      });

      return tx.pedido.update({
        where: {
          id_pedido: idPedido,
        },
        data: {
          cpf_entregador: cpfNovoEntregador,
        },
        include: {
          entregador: { select: { nome: true } },
        },
      });
    });
  }
}