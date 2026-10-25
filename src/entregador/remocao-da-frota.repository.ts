import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { StatusContrato, StatusPedido } from '../generated/prisma/enums';
import { PedidoAlteradoError } from '../pedido/pedido.erros';
import {
  liberarSeOcioso,
  registrarTroca,
  tentarOcuparEntregador,
} from '../pedido/troca-de-entregador';
import { PrismaService } from '../prisma/prisma.service';
import { GanhoEntregaService } from '../remuneracao/ganho-entrega.service';

export interface PedidoReatribuido {
  idPedido: number;
  entregador: { cpf: string; nome: string };
}

export interface ResultadoDaRemocao {
  reatribuidos: PedidoReatribuido[];
  // Sem outro entregador livre na frota: o pedido volta para a fila.
  pendentes: { idPedido: number }[];
}

type Candidato = { cpf: string; nome: string };

type ParametrosCongelados = Awaited<
  ReturnType<GanhoEntregaService['capturarParametros']>
>;

// Campos que a atribuicao congela (E-US16); o pedido de volta na fila fica
// sem eles, como um PENDENTE recem-criado.
const SEM_PARAMETROS_CONGELADOS = {
  taxa_fixa_atribuicao_centavos: null,
  coeficiente_atribuicao_centavos_km: null,
  parametros_vigentes_desde: null,
  remuneracao_atribuida_em: null,
} satisfies Prisma.PedidoUncheckedUpdateManyInput;

@Injectable()
export class RemocaoDaFrotaRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ganhos: GanhoEntregaService,
  ) {}

  // E-US06: encerra o contrato e tira do entregador as entregas em andamento
  // desta empresa, tudo na mesma transacao. Devolve null sem vinculo ativo.
  // Os pedidos de outras empresas e o acesso do entregador nao mudam.
  remover(
    idEmpresa: number,
    cpfEntregador: string,
  ): Promise<ResultadoDaRemocao | null> {
    return this.prisma.$transaction(async (tx) => {
      const agora = new Date();
      const { count } = await tx.contrato.updateMany({
        where: {
          idEmpresa,
          cpf_entregador: cpfEntregador,
          status: StatusContrato.ATIVO,
        },
        data: { status: StatusContrato.ENCERRADO, data_fim: agora },
      });
      if (count === 0) {
        return null;
      }

      const resultado: ResultadoDaRemocao = { reatribuidos: [], pendentes: [] };
      const pedidos = await tx.pedido.findMany({
        where: {
          idEmpresa,
          cpf_entregador: cpfEntregador,
          status: StatusPedido.EM_ANDAMENTO,
        },
        select: { id_pedido: true },
        orderBy: { data_criacao: 'asc' },
      });
      if (pedidos.length === 0) {
        return resultado;
      }

      const candidatos = await this.candidatos(tx, idEmpresa, cpfEntregador);
      // Como na reatribuicao (E-US11), o novo entregador recebe pelos
      // parametros vigentes agora. Sem parametros, a remocao inteira falha.
      let parametros: ParametrosCongelados | undefined;
      for (const { id_pedido: idPedido } of pedidos) {
        const novo = await this.ocuparProximo(tx, candidatos);
        if (novo) {
          parametros ??= await this.ganhos.capturarParametros(
            tx,
            idEmpresa,
            agora,
          );
          await this.passarPara(tx, idPedido, cpfEntregador, novo.cpf, {
            agora,
            parametros,
          });
          resultado.reatribuidos.push({ idPedido, entregador: novo });
        } else {
          await this.devolverParaFila(tx, idPedido, cpfEntregador);
          resultado.pendentes.push({ idPedido });
        }
      }

      await liberarSeOcioso(tx, cpfEntregador);
      return resultado;
    });
  }

  // Outro entregador com vinculo ATIVO nesta empresa e disponivel. Quem tem
  // entrega em andamento ja esta com disponivel = false.
  private candidatos(
    tx: Prisma.TransactionClient,
    idEmpresa: number,
    cpfRemovido: string,
  ): Promise<Candidato[]> {
    return tx.entregador.findMany({
      where: {
        cpf: { not: cpfRemovido },
        disponivel: true,
        contratos: { some: { idEmpresa, status: StatusContrato.ATIVO } },
      },
      select: { cpf: true, nome: true },
      orderBy: { nome: 'asc' },
    });
  }

  // Cada candidato assume no maximo um pedido. Se outra operacao o ocupou
  // depois da leitura, tenta o seguinte.
  private async ocuparProximo(
    tx: Prisma.TransactionClient,
    candidatos: Candidato[],
  ): Promise<Candidato | null> {
    let candidato = candidatos.shift();
    while (candidato) {
      if (await tentarOcuparEntregador(tx, candidato.cpf)) {
        return candidato;
      }
      candidato = candidatos.shift();
    }
    return null;
  }

  private async passarPara(
    tx: Prisma.TransactionClient,
    idPedido: number,
    cpfAnterior: string,
    cpfNovo: string,
    { agora, parametros }: { agora: Date; parametros: ParametrosCongelados },
  ): Promise<void> {
    await this.alterarPedido(tx, idPedido, cpfAnterior, {
      ...parametros,
      cpf_entregador: cpfNovo,
    });
    await registrarTroca(tx, idPedido, cpfAnterior, cpfNovo, agora);
  }

  // PENDENTE e o unico status sem entregador; o inicio da entrega volta a
  // ser marcado na proxima atribuicao (E-US08).
  private async devolverParaFila(
    tx: Prisma.TransactionClient,
    idPedido: number,
    cpfAnterior: string,
  ): Promise<void> {
    await this.alterarPedido(tx, idPedido, cpfAnterior, {
      ...SEM_PARAMETROS_CONGELADOS,
      status: StatusPedido.PENDENTE,
      cpf_entregador: null,
      data_inicio_entrega: null,
    });
  }

  // Se o pedido mudou depois da leitura (ex.: foi finalizado), desfaz tudo.
  private async alterarPedido(
    tx: Prisma.TransactionClient,
    idPedido: number,
    cpfAnterior: string,
    data: Prisma.PedidoUncheckedUpdateManyInput,
  ): Promise<void> {
    const { count } = await tx.pedido.updateMany({
      where: {
        id_pedido: idPedido,
        cpf_entregador: cpfAnterior,
        status: StatusPedido.EM_ANDAMENTO,
        ganho_consolidado_centavos: null,
      },
      data,
    });
    if (count === 0) {
      throw new PedidoAlteradoError();
    }
  }
}
