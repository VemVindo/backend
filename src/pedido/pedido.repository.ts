import { Injectable } from '@nestjs/common';
import { Pedido, Prisma } from '../generated/prisma/client';
import { StatusPedido } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { GanhoEntregaService } from '../remuneracao/ganho-entrega.service';
import { transicaoPermitida } from './regras/status-pedido.regra';
import { CriaPedidoReqDto } from './dto/cria-pedido.dto';
import { PedidoAlteradoError } from './pedido.erros';
import {
  liberarSeOcioso,
  ocuparEntregador,
  registrarTroca,
} from './troca-de-entregador';

export type PedidoComEntregador = Pedido & {
  entregador: { nome: string } | null;
  avaliacao?: { avaliacao_entrega: number } | null;
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly ganhos: GanhoEntregaService,
  ) {}

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
      distancia_conhecida: true,
      cpf_entregador: pedido.cpf_entregador,
    };
    const cpfEntregador = pedido.cpf_entregador;

    if (!cpfEntregador) {
      return await this.prisma.pedido.create({ data: dados });
    }

    return await this.prisma.$transaction(async (cliente_transacional) => {
      const agora = new Date();
      const parametros_congelados = await this.ganhos.capturar_parametros(
        cliente_transacional,
        idEmpresa,
        agora,
      );
      await ocuparEntregador(cliente_transacional, cpfEntregador);
      const criado = await cliente_transacional.pedido.create({
        data: {
          ...dados,
          ...parametros_congelados,
          data_inicio_entrega: agora,
        },
      });
      await registrarTroca(
        cliente_transacional,
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
      include: {
        ...COM_NOME_DO_ENTREGADOR,
        avaliacao: { select: { avaliacao_entrega: true } },
      },
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

  procurarDetalheDaEmpresa(
    idPedido: number,
    idEmpresa: number,
  ): Promise<PedidoComEntregador | null> {
    return this.prisma.pedido.findFirst({
      where: { id_pedido: idPedido, idEmpresa },
      include: COM_NOME_DO_ENTREGADOR,
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
    return this.prisma.$transaction(async (cliente_transacional) => {
      const pedido = await this.bloquear_pedido(
        cliente_transacional,
        dados.idPedido,
      );
      if (
        pedido.status !== dados.statusAtual ||
        pedido.cpf_entregador !== dados.cpfEntregador ||
        pedido.ganho_consolidado_centavos !== null ||
        !transicaoPermitida(pedido.status, dados.novoStatus)
      ) {
        throw new PedidoAlteradoError();
      }
      const concluindo = dados.novoStatus === StatusPedido.FINALIZADO;
      const ganho_consolidado_centavos = concluindo
        ? this.ganhos.consolidar_ganho(pedido)
        : undefined;
      const { count } = await cliente_transacional.pedido.updateMany({
        where: {
          id_pedido: dados.idPedido,
          cpf_entregador: dados.cpfEntregador,
          status: dados.statusAtual,
          ganho_consolidado_centavos: null,
        },
        data: concluindo
          ? {
              status: dados.novoStatus,
              data_finalizacao: new Date(),
              ganho_consolidado_centavos: ganho_consolidado_centavos,
            }
          : { status: dados.novoStatus },
      });
      if (count === 0) {
        throw new PedidoAlteradoError();
      }

      if (concluindo) {
        await liberarSeOcioso(cliente_transacional, dados.cpfEntregador);
      }

      return cliente_transacional.pedido.findUniqueOrThrow({
        where: { id_pedido: dados.idPedido },
        include: COM_NOME_DO_ENTREGADOR,
      });
    });
  }

  // Pedido PENDENTE nao tem entregador (cpfAnterior nulo): a primeira
  // atribuicao leva o pedido para EM_ANDAMENTO, como no cadastro.
  reatribuir(dados: DadosReatribuicao): Promise<PedidoComEntregador> {
    const { idPedido, statusAtual, cpfAnterior, cpfNovo } = dados;

    return this.prisma.$transaction(async (cliente_transacional) => {
      const pedido = await this.bloquear_pedido(cliente_transacional, idPedido);
      if (
        pedido.status !== statusAtual ||
        pedido.cpf_entregador !== cpfAnterior ||
        pedido.ganho_consolidado_centavos !== null ||
        (pedido.status !== StatusPedido.PENDENTE &&
          pedido.status !== StatusPedido.EM_ANDAMENTO) ||
        cpfAnterior === cpfNovo
      ) {
        throw new PedidoAlteradoError();
      }
      const agora = new Date();
      const parametros_congelados = await this.ganhos.capturar_parametros(
        cliente_transacional,
        pedido.idEmpresa,
        agora,
      );
      const atribuicao = {
        ...parametros_congelados,
        cpf_entregador: cpfNovo,
        status: StatusPedido.EM_ANDAMENTO,
      };

      const { count } = await cliente_transacional.pedido.updateMany({
        where: {
          id_pedido: idPedido,
          status: statusAtual,
          cpf_entregador: cpfAnterior,
          ganho_consolidado_centavos: null,
        },
        data:
          statusAtual === StatusPedido.PENDENTE
            ? { ...atribuicao, data_inicio_entrega: agora }
            : atribuicao,
      });
      if (count === 0) {
        throw new PedidoAlteradoError();
      }

      await ocuparEntregador(cliente_transacional, cpfNovo);

      await registrarTroca(
        cliente_transacional,
        idPedido,
        cpfAnterior,
        cpfNovo,
        agora,
      );

      if (cpfAnterior) {
        await liberarSeOcioso(cliente_transacional, cpfAnterior);
      }

      return cliente_transacional.pedido.findUniqueOrThrow({
        where: { id_pedido: idPedido },
        include: COM_NOME_DO_ENTREGADOR,
      });
    });
  }

  private async bloquear_pedido(
    cliente_transacional: Prisma.TransactionClient,
    id_pedido: number,
  ): Promise<Pedido> {
    const pedidos_bloqueados = await cliente_transacional.$queryRaw<
      { id_pedido: number }[]
    >`
      SELECT id_pedido FROM "Pedido" WHERE id_pedido = ${id_pedido} FOR UPDATE
    `;
    if (pedidos_bloqueados.length === 0) throw new PedidoAlteradoError();
    return cliente_transacional.pedido.findUniqueOrThrow({
      where: { id_pedido: id_pedido },
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

  corrigir_distancia(
    id_pedido: number,
    id_empresa: number,
    distancia_metros: number,
  ): Promise<PedidoComEntregador> {
    return this.prisma.$transaction(async (cliente_transacional) => {
      await this.bloquear_pedido(cliente_transacional, id_pedido);
      const { count: quantidade_atualizada } =
        await cliente_transacional.pedido.updateMany({
          where: {
            id_pedido: id_pedido,
            idEmpresa: id_empresa,
            status: { in: [StatusPedido.PENDENTE, StatusPedido.EM_ANDAMENTO] },
            ganho_consolidado_centavos: null,
          },
          data: { distancia: distancia_metros, distancia_conhecida: true },
        });
      if (quantidade_atualizada === 0) throw new PedidoAlteradoError();
      return cliente_transacional.pedido.findUniqueOrThrow({
        where: { id_pedido: id_pedido },
        include: COM_NOME_DO_ENTREGADOR,
      });
    });
  }
}
