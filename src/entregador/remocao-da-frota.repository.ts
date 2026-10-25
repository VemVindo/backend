import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { StatusContrato, StatusPedido } from '../generated/prisma/enums';
import { PedidoAlteradoError } from '../pedido/pedido.erros';
import {
  liberarSeOcioso,
  registrarTroca,
  tentarOcuparEntregador,
  TrocaDeEntregador,
} from '../pedido/troca-de-entregador';
import { PrismaService } from '../prisma/prisma.service';
import { GanhoEntregaService } from '../remuneracao/ganho-entrega.service';

export interface PedidoReatribuido {
  idPedido: number;
  entregador: { cpf: string; nome: string };
}

export interface ResultadoDaRemocao {
  reatribuidos: PedidoReatribuido[];
  pendentes: { idPedido: number }[];
}

type Candidato = { cpf: string; nome: string };

type Remocao = { idEmpresa: number; cpfEntregador: string; agora: Date };

type ParametrosCongelados = Awaited<
  ReturnType<GanhoEntregaService['capturarParametros']>
>;

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

  remover(
    idEmpresa: number,
    cpfEntregador: string,
  ): Promise<ResultadoDaRemocao | null> {
    return this.prisma.$transaction(async (tx) => {
      const agora = new Date();
      if (!(await encerrarContrato(tx, idEmpresa, cpfEntregador, agora))) {
        return null;
      }

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
        return { reatribuidos: [], pendentes: [] };
      }

      const resultado = await this.redistribuir(
        tx,
        { idEmpresa, cpfEntregador, agora },
        pedidos.map(({ id_pedido: idPedido }) => idPedido),
      );
      await liberarSeOcioso(tx, cpfEntregador);
      return resultado;
    });
  }

  private async redistribuir(
    tx: Prisma.TransactionClient,
    { idEmpresa, cpfEntregador, agora }: Remocao,
    idsPedidos: number[],
  ): Promise<ResultadoDaRemocao> {
    const resultado: ResultadoDaRemocao = { reatribuidos: [], pendentes: [] };
    const candidatos = await this.candidatos(tx, idEmpresa, cpfEntregador);
    let parametros: ParametrosCongelados | undefined;
    for (const idPedido of idsPedidos) {
      const novo = await this.ocuparProximo(tx, candidatos);
      if (novo) {
        parametros ??= await this.ganhos.capturarParametros(
          tx,
          idEmpresa,
          agora,
        );
        await this.passarPara(
          tx,
          {
            idPedido,
            cpfAnterior: cpfEntregador,
            cpfNovo: novo.cpf,
            data: agora,
          },
          parametros,
        );
        resultado.reatribuidos.push({ idPedido, entregador: novo });
      } else {
        await this.devolverParaFila(tx, idPedido, cpfEntregador);
        resultado.pendentes.push({ idPedido });
      }
    }
    return resultado;
  }

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
    troca: TrocaDeEntregador & { cpfAnterior: string },
    parametros: ParametrosCongelados,
  ): Promise<void> {
    await this.alterarPedido(tx, troca.idPedido, troca.cpfAnterior, {
      ...parametros,
      cpf_entregador: troca.cpfNovo,
    });
    await registrarTroca(tx, troca);
  }

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

async function encerrarContrato(
  tx: Prisma.TransactionClient,
  idEmpresa: number,
  cpfEntregador: string,
  agora: Date,
): Promise<boolean> {
  const { count } = await tx.contrato.updateMany({
    where: {
      idEmpresa,
      cpf_entregador: cpfEntregador,
      status: StatusContrato.ATIVO,
    },
    data: { status: StatusContrato.ENCERRADO, data_fim: agora },
  });
  return count > 0;
}
