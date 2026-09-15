import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PasswordService } from '../common/security/password.service';
import { ContratoRepository } from '../contrato/contrato.repository';
import { Entregador } from '../generated/prisma/client';
import { CadastrarEntregadorDto } from './dto/cadastrar-entregador.dto';
import { EntregadorRepository } from './entregador.repository';

@Injectable()
export class EntregadorService {
  constructor(
    private readonly entregadores: EntregadorRepository,
    private readonly contratos: ContratoRepository,
    private readonly password: PasswordService,
  ) {}

  async cadastrar(idEmpresa: number, dto: CadastrarEntregadorDto) {
    const existente = await this.entregadores.findByCpf(dto.cpf);
    if (existente) {
      throw new ConflictException(
        'Entregador ja cadastrado na plataforma; use o vinculo pelo CPF',
      );
    }
    const senhaTemporaria = this.gerarSenhaTemporaria();
    const senhaHash = await this.password.hash(senhaTemporaria);
    const entregador = await this.entregadores.create({
      nome: dto.nome,
      cpf: dto.cpf,
      telefone: dto.telefone,
      tipoVeiculo: dto.tipoVeiculo,
      placa: dto.placa ?? null,
      senhaHash,
    });
    await this.contratos.criarVinculo(idEmpresa, entregador.cpf);

    return { entregador: this.toResumo(entregador), senhaTemporaria };
  }

  async vincular(idEmpresa: number, cpf: string) {
    const entregador = await this.entregadores.findByCpf(cpf);
    if (!entregador) {
      throw new NotFoundException(
        'Entregador nao encontrado para o CPF informado',
      );
    }
    const vinculo = await this.contratos.findVinculoAtivo(
      idEmpresa,
      entregador.cpf,
    );
    if (vinculo) {
      throw new ConflictException(
        'Entregador ja vinculado a este estabelecimento',
      );
    }
    await this.contratos.criarVinculo(idEmpresa, entregador.cpf);
    return { entregador: this.toResumo(entregador), vinculado: true };
  }

  async listarFrota(idEmpresa: number) {
    const entregadores = await this.entregadores.findAtivosByEmpresa(idEmpresa);
    return entregadores.map((entregador) => ({
      cpf: entregador.cpf,
      nome: entregador.nome,
      tipoVeiculo: entregador.tipo_veiculo,
      disponivel: entregador.disponivel,
    }));
  }

  private toResumo(entregador: Entregador) {
    return {
      cpf: entregador.cpf,
      nome: entregador.nome,
      tipoVeiculo: entregador.tipo_veiculo,
      placa: entregador.placa,
    };
  }

  private gerarSenhaTemporaria(): string {
    return randomBytes(9).toString('base64url');
  }
}
