import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Entregador } from '../generated/prisma/client';

export interface CreateEntregadorData {
  nome: string;
  cpf: string;
  telefone: string;
  tipoVeiculo: string;
  placa: string | null;
  senhaHash: string;
}

@Injectable()
export class EntregadorRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByCpf(cpf: string): Promise<Entregador | null> {
    return this.prisma.entregador.findUnique({ where: { cpf } });
  }

  findAtivosByEmpresa(idEmpresa: number): Promise<Entregador[]> {
    return this.prisma.entregador.findMany({
      where: { contratos: { some: { idEmpresa, data_fim: null } } },
    });
  }

  createComVinculo(
    data: CreateEntregadorData,
    idEmpresa: number,
  ): Promise<Entregador> {
    return this.prisma.entregador.create({
      data: {
        nome: data.nome,
        cpf: data.cpf,
        telefone: data.telefone,
        tipo_veiculo: data.tipoVeiculo,
        placa: data.placa,
        senha: data.senhaHash,
        contratos: { create: { idEmpresa, data_inicio: new Date() } },
      },
    });
  }

  updateSenha(cpf: string, senhaHash: string): Promise<Entregador> {
    return this.prisma.entregador.update({
      where: { cpf },
      data: { senha: senhaHash, senha_temporaria: false },
    });
  }
}
