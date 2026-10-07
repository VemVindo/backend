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
}

@Injectable()
export class EntregadorRepository {
  constructor(private readonly prisma: PrismaService) { }

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

  procurarAtivoPorEmpresa(
    idEmpresa: number,
    cpfEntregador: string,
  ): Promise<Entregador | null> {
    return this.prisma.entregador.findFirst({
      where: {
        cpf: cpfEntregador,
        contratos: {
          some: {
            idEmpresa,
            status: StatusContrato.ATIVO,
          },
        },
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
        ...(cienciaDadosEm && { ciencia_dados_em: cienciaDadosEm }),
      },
    });
  }
}
