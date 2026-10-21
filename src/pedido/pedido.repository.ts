import { Injectable } from '@nestjs/common';
import { Pedido, Prisma } from '../generated/prisma/client';
import { StatusPedido } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { CriaPedidoReqDto } from './dto/cria-pedido.dto';
import {
  EntregadorIndisponivelError,
  PedidoAlteradoError,
} from './pedido.erros';

export type PedidoComEntregador = Pedido & {
  entregador: { nome: string } | null;
};

export type PedidoComEmpresa = Pedido & {
  empresa: { nome_fantasia: string };
};

export type PedidoComContatos = Pedido & {
  empresa: { nome_fantasia: string; telefone: string };
  entregador: { nome: string; telefone: string } | null;
};

export type DonoDoPedido = { idEmpresa: number } | { cpf_entregador: string };

export interface DadosAtualizacaoStatus {
  idPedido: number;
  cpfEntregador: string;
  statusAtual: StatusPedido;
  novoStatus: StatusPedido;
  finalizar: boolean;
}

export interface DadosReatribuicao {
  idPedido: number;
  statusAtual: StatusPedido;
  cpfAnterior: string | null;
  cpfNovo: string;
}

export interface RegistroHistoricoEntregador {
  data: Date;
  entregadorAntigo: { nome: string } | null;
  entregadorNovo: { nome: string };
}

const COM_NOME_DO_ENTREGADOR = {
  entregador: { select: { nome: true } },
} satisfies Prisma.PedidoInclude;

@Injectable()
export class PedidoRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Com entregador, o pedido ja nasce EM_ANDAMENTO, ocupa o entregador e abre
  // o historico na mesma transacao, como na atribuicao.
  async criar(pedido: CriaPedidoReqDto, idEmpresa: number): Promise<Pedido> {
    const dados: Prisma.PedidoUncheckedCreateInput = {
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
      idEmpresa,
      distancia: pedido.distancia,
      cpf_entregador: pedido.cpf_entregador,
    };
    const cpfEntregador = pedido.cpf_entregador;

    if (!cpfEntregador) {
      return await this.prisma.pedido.create({ data: dados });
    }

    return await this.prisma.$transaction(async (tx) => {
      const agora = new Date();
      await this.ocuparEntregador(tx, cpfEntregador);
      const criado = await tx.pedido.create({
        data: { ...dados, data_inicio_entrega: agora },
      });
      await this.registrarTroca(
        tx,
        criado.id_pedido,
        null,
        cpfEntregador,
        agora,
      );
      return criado;
    });
  }

  listarDaEmpresa(idEmpresa: number): Promise<PedidoComEntregador[]> {
    return this.prisma.pedido.findMany({
      where: { idEmpresa },
      include: COM_NOME_DO_ENTREGADOR,
      orderBy: { data_criacao: 'desc' },
    });
  }

  listarDoEntregador(cpfEntregador: string): Promise<PedidoComEmpresa[]> {
    return this.prisma.pedido.findMany({
      where: { cpf_entregador: cpfEntregador },
      include: { empresa: { select: { nome_fantasia: true } } },
      orderBy: { data_criacao: 'desc' },
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

  procurarComContatos(
    idPedido: number,
    dono: DonoDoPedido,
  ): Promise<PedidoComContatos | null> {
    return this.prisma.pedido.findFirst({
      where: { id_pedido: idPedido, ...dono },
      include: {
        empresa: { select: { nome_fantasia: true, telefone: true } },
        entregador: { select: { nome: true, telefone: true } },
      },
    });
  }

  // O where repete o status lido pelo service; se o pedido mudou nesse meio
  // tempo, nenhuma linha e afetada e nada e gravado.
  atualizarStatus(dados: DadosAtualizacaoStatus): Promise<PedidoComEntregador> {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.pedido.updateMany({
        where: {
          id_pedido: dados.idPedido,
          cpf_entregador: dados.cpfEntregador,
          status: dados.statusAtual,
        },
        data: dados.finalizar
          ? { status: dados.novoStatus, data_finalizacao: new Date() }
          : { status: dados.novoStatus },
      });
      if (count === 0) {
        throw new PedidoAlteradoError();
      }

      if (dados.finalizar) {
        await this.liberarSeOcioso(tx, dados.cpfEntregador);
      }

      return tx.pedido.findUniqueOrThrow({
        where: { id_pedido: dados.idPedido },
        include: COM_NOME_DO_ENTREGADOR,
      });
    });
  }

  // Pedido PENDENTE nao tem entregador (cpfAnterior nulo): a primeira
  // atribuicao leva o pedido para EM_ANDAMENTO, como no cadastro.
  reatribuir(dados: DadosReatribuicao): Promise<PedidoComEntregador> {
    const { idPedido, statusAtual, cpfAnterior, cpfNovo } = dados;

    return this.prisma.$transaction(async (tx) => {
      const agora = new Date();
      const atribuicao = {
        cpf_entregador: cpfNovo,
        status: StatusPedido.EM_ANDAMENTO,
      };

      const { count } = await tx.pedido.updateMany({
        where: {
          id_pedido: idPedido,
          status: statusAtual,
          cpf_entregador: cpfAnterior,
        },
        data:
          statusAtual === StatusPedido.PENDENTE
            ? { ...atribuicao, data_inicio_entrega: agora }
            : atribuicao,
      });
      if (count === 0) {
        throw new PedidoAlteradoError();
      }

      await this.ocuparEntregador(tx, cpfNovo);

      await this.registrarTroca(tx, idPedido, cpfAnterior, cpfNovo, agora);

      if (cpfAnterior) {
        await this.liberarSeOcioso(tx, cpfAnterior);
      }

      return tx.pedido.findUniqueOrThrow({
        where: { id_pedido: idPedido },
        include: COM_NOME_DO_ENTREGADOR,
      });
    });
  }

  listarHistoricoDeEntregadores(
    idPedido: number,
  ): Promise<RegistroHistoricoEntregador[]> {
    return this.prisma.historicoPedidoEntregadores.findMany({
      where: { id_pedido: idPedido },
      orderBy: { data: 'asc' },
      select: {
        data: true,
        entregadorAntigo: { select: { nome: true } },
        entregadorNovo: { select: { nome: true } },
      },
    });
  }

  private async registrarTroca(
    tx: Prisma.TransactionClient,
    idPedido: number,
    cpfAnterior: string | null,
    cpfNovo: string,
    data: Date,
  ): Promise<void> {
    await tx.historicoPedidoEntregadores.create({
      data: {
        id_pedido: idPedido,
        cpf_entregador_antigo: cpfAnterior,
        cpf_entregador_novo: cpfNovo,
        data,
      },
    });
  }

  // So ocupa se ainda estiver disponivel: duas atribuicoes simultaneas nao
  // conseguem pegar o mesmo entregador.
  private async ocuparEntregador(
    tx: Prisma.TransactionClient,
    cpfEntregador: string,
  ): Promise<void> {
    const { count } = await tx.entregador.updateMany({
      where: { cpf: cpfEntregador, disponivel: true },
      data: { disponivel: false },
    });
    if (count === 0) {
      throw new EntregadorIndisponivelError();
    }
  }

  // A disponibilidade vale para todas as empresas do entregador, entao so
  // volta a true quando nao sobra nenhuma entrega em andamento.
  private async liberarSeOcioso(
    tx: Prisma.TransactionClient,
    cpfEntregador: string,
  ): Promise<void> {
    const emAndamento = await tx.pedido.count({
      where: {
        cpf_entregador: cpfEntregador,
        status: StatusPedido.EM_ANDAMENTO,
      },
    });
    if (emAndamento === 0) {
      await tx.entregador.update({
        where: { cpf: cpfEntregador },
        data: { disponivel: true },
      });
    }
  }
}
