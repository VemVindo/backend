import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Contrato } from '../generated/prisma/client';
import { StatusContrato } from '../generated/prisma/enums';

export type ContratoComEmpresa = Contrato & {
  empresa: { nome_fantasia: string };
};

@Injectable()
export class ContratoRepository {
  constructor(private readonly prisma: PrismaService) {}

  // O indice parcial Contrato_vinculo_ativo_key barra um segundo convite em aberto.
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

  // O primeiro contrato indica a empresa que cadastrou o entregador.
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

  // Dono e status no mesmo where: evita alterar contrato alheio ou ja respondido.
  async aceitar(idContrato: number, cpfEntregador: string): Promise<boolean> {
    const { count } = await this.prisma.contrato.updateMany({
      where: {
        id_contrato: idContrato,
        cpf_entregador: cpfEntregador,
        status: StatusContrato.PENDENTE,
      },
      data: { status: StatusContrato.ATIVO, data_aceite: new Date() },
    });
    return count > 0;
  }

  async recusar(idContrato: number, cpfEntregador: string): Promise<boolean> {
    const { count } = await this.prisma.contrato.updateMany({
      where: {
        id_contrato: idContrato,
        cpf_entregador: cpfEntregador,
        status: StatusContrato.PENDENTE,
      },
      data: { status: StatusContrato.RECUSADO, data_fim: new Date() },
    });
    return count > 0;
  }

  async encerrarPeloEntregador(
    idContrato: number,
    cpfEntregador: string,
  ): Promise<boolean> {
    const { count } = await this.prisma.contrato.updateMany({
      where: {
        id_contrato: idContrato,
        cpf_entregador: cpfEntregador,
        status: StatusContrato.ATIVO,
      },
      data: { status: StatusContrato.ENCERRADO, data_fim: new Date() },
    });
    return count > 0;
  }

  async encerrarPelaEmpresa(
    idEmpresa: number,
    cpfEntregador: string,
  ): Promise<boolean> {
    const { count } = await this.prisma.contrato.updateMany({
      where: {
        idEmpresa,
        cpf_entregador: cpfEntregador,
        status: StatusContrato.ATIVO,
      },
      data: { status: StatusContrato.ENCERRADO, data_fim: new Date() },
    });
    return count > 0;
  }
}
