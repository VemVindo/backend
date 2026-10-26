import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Contrato, Prisma } from '../generated/prisma/client';
import { StatusContrato } from '../generated/prisma/enums';

export type ContratoComEmpresa = Contrato & {
  empresa: { nome_fantasia: string };
};

@Injectable()
export class ContratoRepository {
  constructor(private readonly prisma: PrismaService) {}

  criarConvite(idEmpresa: number, cpfEntregador: string): Promise<Contrato> {
    return this.prisma.contrato.create({
      data: {
        idEmpresa,
        cpf_entregador: cpfEntregador,
        status: StatusContrato.PENDENTE,
        data_inicio: new Date(),
      },
    });
  }

  primeiroDoEntregador(cpfEntregador: string): Promise<Contrato | null> {
    return this.prisma.contrato.findFirst({
      where: { cpf_entregador: cpfEntregador },
      orderBy: { id_contrato: 'asc' },
    });
  }

  listarAbertosDoEntregador(
    cpfEntregador: string,
  ): Promise<ContratoComEmpresa[]> {
    return this.prisma.contrato.findMany({
      where: {
        cpf_entregador: cpfEntregador,
        status: { in: [StatusContrato.PENDENTE, StatusContrato.ATIVO] },
      },
      include: { empresa: { select: { nome_fantasia: true } } },
      orderBy: { data_inicio: 'desc' },
    });
  }

  aceitar(idContrato: number, cpfEntregador: string): Promise<boolean> {
    return this.mudarStatus(
      idContrato,
      cpfEntregador,
      StatusContrato.PENDENTE,
      {
        status: StatusContrato.ATIVO,
        data_aceite: new Date(),
      },
    );
  }

  recusar(idContrato: number, cpfEntregador: string): Promise<boolean> {
    return this.mudarStatus(
      idContrato,
      cpfEntregador,
      StatusContrato.PENDENTE,
      {
        status: StatusContrato.RECUSADO,
        data_fim: new Date(),
      },
    );
  }

  encerrarPeloEntregador(
    idContrato: number,
    cpfEntregador: string,
  ): Promise<boolean> {
    return this.mudarStatus(idContrato, cpfEntregador, StatusContrato.ATIVO, {
      status: StatusContrato.ENCERRADO,
      data_fim: new Date(),
    });
  }

  private async mudarStatus(
    idContrato: number,
    cpfEntregador: string,
    statusAtual: StatusContrato,
    alteracao: Prisma.ContratoUpdateManyMutationInput,
  ): Promise<boolean> {
    const { count } = await this.prisma.contrato.updateMany({
      where: {
        id_contrato: idContrato,
        cpf_entregador: cpfEntregador,
        status: statusAtual,
      },
      data: alteracao,
    });
    return count > 0;
  }
}
