import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Entregador } from '../generated/prisma/client';
import { StatusContrato } from '../generated/prisma/enums';

export interface DadosNovoEntregador {
  nome: string;
  cpf: string;
  telefone: string;
  tipoVeiculo: string;
  placa: string | null;
  senhaHash: string;
  senhaTemporariaExpiraEm: Date;
}

@Injectable()
export class EntregadorRepository {
  constructor(private readonly prisma: PrismaService) {}

  procurarPorCpf(cpf: string): Promise<Entregador | null> {
    return this.prisma.entregador.findUnique({ where: { cpf } });
  }

  procurarAtivosPorEmpresa(idEmpresa: number): Promise<Entregador[]> {
    return this.prisma.entregador.findMany({
      where: {
        contratos: { some: { idEmpresa, status: StatusContrato.ATIVO } },
      },
    });
  }

  criarComConvite(
    dados: DadosNovoEntregador,
    idEmpresa: number,
  ): Promise<Entregador> {
    return this.prisma.entregador.create({
      data: {
        nome: dados.nome,
        cpf: dados.cpf,
        telefone: dados.telefone,
        tipo_veiculo: dados.tipoVeiculo,
        placa: dados.placa,
        senha: dados.senhaHash,
        senha_temporaria_expira_em: dados.senhaTemporariaExpiraEm,
        contratos: {
          create: {
            idEmpresa,
            status: StatusContrato.PENDENTE,
            data_inicio: new Date(),
          },
        },
      },
    });
  }

  // Trocar a senha tambem encerra as sessoes abertas em outros aparelhos.
  atualizarSenha(
    cpf: string,
    senhaHash: string,
    cienciaDadosEm?: Date,
  ): Promise<Entregador> {
    return this.prisma.entregador.update({
      where: { cpf },
      data: {
        senha: senhaHash,
        senha_temporaria: false,
        senha_temporaria_expira_em: null,
        sessao_versao: { increment: 1 },
        ...(cienciaDadosEm && { ciencia_dados_em: cienciaDadosEm }),
      },
    });
  }

  // senha_temporaria no where: se o entregador criou a propria senha no meio
  // do caminho, nada muda.
  async redefinirSenhaTemporaria(
    cpf: string,
    senhaHash: string,
    expiraEm: Date,
  ): Promise<boolean> {
    const { count } = await this.prisma.entregador.updateMany({
      where: { cpf, senha_temporaria: true },
      data: {
        senha: senhaHash,
        senha_temporaria_expira_em: expiraEm,
        sessao_versao: { increment: 1 },
      },
    });
    return count > 0;
  }

  async versaoSessao(cpf: string): Promise<number | null> {
    const entregador = await this.prisma.entregador.findUnique({
      where: { cpf },
      select: { sessao_versao: true },
    });
    return entregador?.sessao_versao ?? null;
  }

  async encerrarSessoes(cpf: string): Promise<void> {
    await this.prisma.entregador.update({
      where: { cpf },
      data: { sessao_versao: { increment: 1 } },
    });
  }
}
