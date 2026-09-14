import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Empresa } from '../generated/prisma/client';

export interface CreateEmpresaData {
  nomeFantasia: string;
  email: string;
  telefone: string;
  cnpj: string | null;
  cpf: string | null;
  cep: string;
  logradouro: string;
  numero: number;
  complemento: string | null;
  bairro: string;
  cidade: string;
  uf: string;
  razaoSocial: string | null;
  senhaHash: string;
}

@Injectable()
export class EmpresaRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<Empresa | null> {
    return this.prisma.empresa.findUnique({ where: { email } });
  }

  async findByDocumento(
    cnpj: string | null,
    cpf: string | null,
  ): Promise<Empresa | null> {
    if (cnpj) {
      const byCnpj = await this.prisma.empresa.findUnique({
        where: { CNPJ: cnpj },
      });
      if (byCnpj) return byCnpj;
    }
    if (cpf) {
      const byCpf = await this.prisma.empresa.findUnique({ where: { cpf } });
      if (byCpf) return byCpf;
    }
    return null;
  }

  create(data: CreateEmpresaData): Promise<Empresa> {
    return this.prisma.empresa.create({
      data: {
        nome_fantasia: data.nomeFantasia,
        email: data.email,
        telefone: data.telefone,
        CNPJ: data.cnpj,
        cpf: data.cpf,
        cep: data.cep,
        logradouro: data.logradouro,
        numero: data.numero,
        complemento: data.complemento,
        bairro: data.bairro,
        cidade: data.cidade,
        UF: data.uf,
        razao_social: data.razaoSocial,
        senha: data.senhaHash,
      },
    });
  }
}
