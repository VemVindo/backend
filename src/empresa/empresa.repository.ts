import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Empresa } from '../generated/prisma/client';

export interface DadosNovaEmpresa {
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

export type DadosCadastrais = Pick<
  DadosNovaEmpresa,
  | 'nomeFantasia'
  | 'email'
  | 'telefone'
  | 'cep'
  | 'logradouro'
  | 'numero'
  | 'complemento'
  | 'bairro'
  | 'cidade'
  | 'uf'
>;

@Injectable()
export class EmpresaRepository {
  constructor(private readonly prisma: PrismaService) {}

  procurarPorEmail(email: string): Promise<Empresa | null> {
    return this.prisma.empresa.findUnique({ where: { email } });
  }

  procurarPorId(id: number): Promise<Empresa | null> {
    return this.prisma.empresa.findUnique({ where: { id_empresa: id } });
  }

  async procurarPorDocumento(
    cnpj: string | null,
    cpf: string | null,
  ): Promise<Empresa | null> {
    if (cnpj) {
      const porCnpj = await this.prisma.empresa.findUnique({
        where: { CNPJ: cnpj },
      });
      if (porCnpj) return porCnpj;
    }
    if (cpf) {
      const porCpf = await this.prisma.empresa.findUnique({ where: { cpf } });
      if (porCpf) return porCpf;
    }
    return null;
  }

  criar(dados: DadosNovaEmpresa): Promise<Empresa> {
    return this.prisma.empresa.create({
      data: {
        nome_fantasia: dados.nomeFantasia,
        email: dados.email,
        telefone: dados.telefone,
        CNPJ: dados.cnpj,
        cpf: dados.cpf,
        cep: dados.cep,
        logradouro: dados.logradouro,
        numero: dados.numero,
        complemento: dados.complemento,
        bairro: dados.bairro,
        cidade: dados.cidade,
        UF: dados.uf,
        razao_social: dados.razaoSocial,
        senha: dados.senhaHash,
      },
    });
  }

  atualizarCadastro(
    id: number,
    dados: DadosCadastrais,
    enderecoMudou: boolean,
    agora: Date,
  ): Promise<Empresa> {
    return this.prisma.empresa.update({
      where: { id_empresa: id },
      data: {
        nome_fantasia: dados.nomeFantasia,
        email: dados.email,
        telefone: dados.telefone,
        cep: dados.cep,
        logradouro: dados.logradouro,
        numero: dados.numero,
        complemento: dados.complemento,
        bairro: dados.bairro,
        cidade: dados.cidade,
        UF: dados.uf,
        cadastro_atualizado_em: agora,
        ...(enderecoMudou ? { origem_lat: null, origem_lng: null } : {}),
      },
    });
  }

  async versaoSessao(id: number): Promise<number | null> {
    const empresa = await this.prisma.empresa.findUnique({
      where: { id_empresa: id },
      select: { sessao_versao: true },
    });
    return empresa?.sessao_versao ?? null;
  }

  async exibeMapa(id: number): Promise<boolean | null> {
    const empresa = await this.prisma.empresa.findUnique({
      where: { id_empresa: id },
      select: { exibir_mapa: true },
    });
    return empresa?.exibir_mapa ?? null;
  }

  async definirExibirMapa(id: number, exibirMapa: boolean): Promise<void> {
    await this.prisma.empresa.update({
      where: { id_empresa: id },
      data: { exibir_mapa: exibirMapa },
    });
  }

  async encerrarSessoes(id: number): Promise<void> {
    await this.prisma.empresa.update({
      where: { id_empresa: id },
      data: { sessao_versao: { increment: 1 } },
    });
  }
}
