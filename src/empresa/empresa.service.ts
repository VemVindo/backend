import { Injectable, NotFoundException } from '@nestjs/common';
import { EmpresaRepository } from './empresa.repository';

export interface ConfiguracoesDaEmpresa {
  exibirMapa: boolean;
}

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
}
