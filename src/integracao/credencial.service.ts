import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CredencialIntegracao } from '../generated/prisma/client';
import { violouUnicidade } from '../prisma/prisma-errors';
import { chaveConfere, extrairPrefixo, gerarChave } from './chave-integracao';
import { CredencialRepository } from './credencial.repository';

export interface IntegracaoAutenticada {
  empresaId: number;
  credencialId: number;
}

@Injectable()
export class CredencialService {
  constructor(private readonly credenciais: CredencialRepository) {}

  async consultar(idEmpresa: number) {
    const ativa = await this.credenciais.procurarAtiva(idEmpresa);
    return { credencial: ativa ? this.resumo(ativa) : null };
  }

  async gerar(idEmpresa: number) {
    if (await this.credenciais.procurarAtiva(idEmpresa)) {
      throw this.jaExiste();
    }
    const nova = gerarChave();
    let credencial: CredencialIntegracao;
    try {
      credencial = await this.credenciais.criar(
        idEmpresa,
        nova.prefixo,
        nova.hash,
      );
    } catch (erro) {
      if (violouUnicidade(erro)) {
        throw this.jaExiste();
      }
      throw erro;
    }
    return { chave: nova.chave, credencial: this.resumo(credencial) };
  }

  async rotacionar(idEmpresa: number) {
    if (!(await this.credenciais.procurarAtiva(idEmpresa))) {
      throw this.nenhumaAtiva();
    }
    const nova = gerarChave();
    let credencial: CredencialIntegracao;
    try {
      credencial = await this.credenciais.substituir(
        idEmpresa,
        nova.prefixo,
        nova.hash,
      );
    } catch (erro) {
      if (violouUnicidade(erro)) {
        throw new ConflictException(
          'A credencial foi alterada por outra requisicao; tente novamente',
        );
      }
      throw erro;
    }
    return { chave: nova.chave, credencial: this.resumo(credencial) };
  }

  async revogar(idEmpresa: number) {
    const revogadas = await this.credenciais.revogarAtiva(idEmpresa);
    if (revogadas === 0) {
      throw this.nenhumaAtiva();
    }
  }

  // A empresa vem sempre da credencial, nunca do corpo da requisicao: uma chave
  // so enxerga os dados do estabelecimento que a gerou.
  async autenticar(chave: string): Promise<IntegracaoAutenticada | null> {
    const prefixo = extrairPrefixo(chave);
    if (!prefixo) {
      return null;
    }
    const credencial = await this.credenciais.procurarPorPrefixo(prefixo);
    if (
      !credencial ||
      credencial.data_revogacao ||
      !chaveConfere(chave, credencial.hash)
    ) {
      return null;
    }
    await this.credenciais.registrarUso(credencial.id_credencial);
    return {
      empresaId: credencial.idEmpresa,
      credencialId: credencial.id_credencial,
    };
  }

  private resumo(credencial: CredencialIntegracao) {
    return {
      prefixo: `vv_${credencial.prefixo}`,
      criadaEm: credencial.data_criacao,
      ultimoUso: credencial.ultimo_uso,
    };
  }

  private jaExiste() {
    return new ConflictException(
      'Ja existe uma credencial ativa; use a rotacao para gerar outra',
    );
  }

  private nenhumaAtiva() {
    return new NotFoundException('Nenhuma credencial ativa');
  }
}
