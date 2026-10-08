import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CredencialIntegracao } from '../generated/prisma/client';

@Injectable()
export class CredencialRepository {
  constructor(private readonly prisma: PrismaService) {}

  procurarAtiva(idEmpresa: number): Promise<CredencialIntegracao | null> {
    return this.prisma.credencialIntegracao.findFirst({
      where: { idEmpresa, data_revogacao: null },
    });
  }

  procurarPorPrefixo(prefixo: string): Promise<CredencialIntegracao | null> {
    return this.prisma.credencialIntegracao.findUnique({ where: { prefixo } });
  }

  criar(
    idEmpresa: number,
    prefixo: string,
    hash: string,
  ): Promise<CredencialIntegracao> {
    return this.prisma.credencialIntegracao.create({
      data: { idEmpresa, prefixo, hash },
    });
  }

  // Revoga a ativa e cria a nova na mesma transacao: a empresa nunca fica com
  // duas chaves validas nem sem nenhuma no meio da troca.
  substituir(
    idEmpresa: number,
    prefixo: string,
    hash: string,
  ): Promise<CredencialIntegracao> {
    return this.prisma.$transaction(async (tx) => {
      await tx.credencialIntegracao.updateMany({
        where: { idEmpresa, data_revogacao: null },
        data: { data_revogacao: new Date() },
      });
      return tx.credencialIntegracao.create({
        data: { idEmpresa, prefixo, hash },
      });
    });
  }

  async revogarAtiva(idEmpresa: number): Promise<number> {
    const { count } = await this.prisma.credencialIntegracao.updateMany({
      where: { idEmpresa, data_revogacao: null },
      data: { data_revogacao: new Date() },
    });
    return count;
  }

  async registrarUso(idCredencial: number): Promise<void> {
    await this.prisma.credencialIntegracao.update({
      where: { id_credencial: idCredencial },
      data: { ultimo_uso: new Date() },
    });
  }
}
