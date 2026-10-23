import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Empresa } from '../generated/prisma/client';
import { violouUnicidade } from '../prisma/prisma-errors';
import { DadosCadastrais, EmpresaRepository } from './empresa.repository';

export interface ConfiguracoesDaEmpresa {
  exibirMapa: boolean;
}

export interface CadastroDaEmpresa {
  nomeFantasia: string;
  razaoSocial: string | null;
  documento: { tipo: 'CNPJ' | 'CPF'; numero: string };
  email: string;
  telefone: string;
  endereco: {
    cep: string;
    logradouro: string;
    numero: number;
    complemento: string | null;
    bairro: string;
    cidade: string;
    uf: string;
  };
  criadaEm: Date;
  atualizadaEm: Date;
}

// Campos que mudam o ponto no mapa; o complemento nao entra na geocodificacao.
const CAMPOS_DO_ENDERECO = [
  'cep',
  'logradouro',
  'numero',
  'bairro',
  'cidade',
] as const;

@Injectable()
export class EmpresaService {
  constructor(private readonly empresas: EmpresaRepository) {}

  async consultarConfiguracoes(
    idEmpresa: number,
  ): Promise<ConfiguracoesDaEmpresa> {
    const exibirMapa = await this.empresas.exibeMapa(idEmpresa);
    if (exibirMapa === null) {
      throw new NotFoundException('Empresa não encontrada');
    }
    return { exibirMapa };
  }

  async atualizarConfiguracoes(
    idEmpresa: number,
    configuracoes: ConfiguracoesDaEmpresa,
  ): Promise<ConfiguracoesDaEmpresa> {
    await this.empresas.definirExibirMapa(idEmpresa, configuracoes.exibirMapa);
    return { exibirMapa: configuracoes.exibirMapa };
  }

  async consultarCadastro(idEmpresa: number): Promise<CadastroDaEmpresa> {
    return paraCadastro(await this.exigirEmpresa(idEmpresa));
  }

  // E-US03: mesmas validacoes do cadastro; o e-mail continua unico.
  async atualizarCadastro(
    idEmpresa: number,
    dados: DadosCadastrais,
    agora = new Date(),
  ): Promise<CadastroDaEmpresa> {
    const atual = await this.exigirEmpresa(idEmpresa);

    if (dados.email !== atual.email) {
      const dono = await this.empresas.procurarPorEmail(dados.email);
      if (dono && dono.id_empresa !== idEmpresa) {
        throw new ConflictException('E-mail ja cadastrado');
      }
    }

    const enderecoMudou =
      CAMPOS_DO_ENDERECO.some((campo) => dados[campo] !== atual[campo]) ||
      dados.uf !== atual.UF;

    try {
      const atualizada = await this.empresas.atualizarCadastro(
        idEmpresa,
        { ...dados, complemento: dados.complemento ?? null },
        enderecoMudou,
        agora,
      );
      return paraCadastro(atualizada);
    } catch (erro) {
      if (violouUnicidade(erro)) {
        throw new ConflictException('E-mail ja cadastrado');
      }
      throw erro;
    }
  }

  private async exigirEmpresa(idEmpresa: number): Promise<Empresa> {
    const empresa = await this.empresas.procurarPorId(idEmpresa);
    if (!empresa) {
      throw new NotFoundException('Empresa não encontrada');
    }
    return empresa;
  }
}

function paraCadastro(empresa: Empresa): CadastroDaEmpresa {
  return {
    nomeFantasia: empresa.nome_fantasia,
    razaoSocial: empresa.razao_social,
    documento: empresa.CNPJ
      ? { tipo: 'CNPJ', numero: empresa.CNPJ }
      : { tipo: 'CPF', numero: empresa.cpf ?? '' },
    email: empresa.email,
    telefone: empresa.telefone,
    endereco: {
      cep: empresa.cep,
      logradouro: empresa.logradouro,
      numero: empresa.numero,
      complemento: empresa.complemento,
      bairro: empresa.bairro,
      cidade: empresa.cidade,
      uf: empresa.UF,
    },
    criadaEm: empresa.criada_em,
    atualizadaEm: empresa.cadastro_atualizado_em,
  };
}
