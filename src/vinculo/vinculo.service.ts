import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ContratoRepository } from '../contrato/contrato.repository';
import { dadosVisiveisParaEmpresa } from '../entregador/dados-visiveis-empresa';
import { EntregadorRepository } from '../entregador/entregador.repository';

@Injectable()
export class VinculoService {
  constructor(
    private readonly entregadores: EntregadorRepository,
    private readonly contratos: ContratoRepository,
  ) {}

  async dadosCompartilhados(cpf: string) {
    const entregador = await this.entregadores.procurarPorCpf(cpf);
    if (!entregador) {
      throw new UnauthorizedException();
    }
    return { dados: dadosVisiveisParaEmpresa(entregador) };
  }

  async listar(cpf: string) {
    const contratos = await this.contratos.listarAbertosDoEntregador(cpf);
    return contratos.map((contrato) => ({
      id: contrato.id_contrato,
      empresa: contrato.empresa.nome_fantasia,
      status: contrato.status,
      convidadoEm: contrato.data_inicio,
      aceitoEm: contrato.data_aceite,
    }));
  }

  async aceitar(idContrato: number, cpf: string) {
    if (!(await this.contratos.aceitar(idContrato, cpf))) {
      throw this.conviteNaoEncontrado();
    }
  }

  async recusar(idContrato: number, cpf: string) {
    if (!(await this.contratos.recusar(idContrato, cpf))) {
      throw this.conviteNaoEncontrado();
    }
  }

  async encerrar(idContrato: number, cpf: string) {
    if (!(await this.contratos.encerrarPeloEntregador(idContrato, cpf))) {
      throw new NotFoundException('Vinculo ativo nao encontrado');
    }
  }

  private conviteNaoEncontrado() {
    return new NotFoundException('Convite pendente nao encontrado');
  }
}
