import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Contrato } from '../generated/prisma/client';

@Injectable()
export class ContratoRepository {
  constructor(private readonly prisma: PrismaService) {}

  findVinculoAtivo(
    idEmpresa: number,
    cpfEntregador: string,
  ): Promise<Contrato | null> {
    return this.prisma.contrato.findFirst({
      where: { idEmpresa, cpf_entregador: cpfEntregador, data_fim: null },
    });
  }

  criarVinculo(idEmpresa: number, cpfEntregador: string): Promise<Contrato> {
    return this.prisma.contrato.create({
      data: {
        idEmpresa,
        cpf_entregador: cpfEntregador,
        data_inicio: new Date(),
      },
    });
  }
}
