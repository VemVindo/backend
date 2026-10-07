import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { SenhaService } from '../common/security/senha.service';
import { ContratoRepository } from '../contrato/contrato.repository';
import { Entregador } from '../generated/prisma/client';
import { StatusContrato } from '../generated/prisma/enums';
import { TipoVeiculo } from '../common/enums/tipo-veiculo.enum';
import { violouUnicidade } from '../prisma/prisma-errors';
import { CadastrarEntregadorDto } from './dto/cadastrar-entregador.dto';
import { dadosVisiveisParaEmpresa } from './dados-visiveis-empresa';
import { EntregadorRepository } from './entregador.repository';

export const MENSAGEM_CONVITE =
  'Se o CPF for de um entregador cadastrado, ele recebera o convite no app. ' +
  'Ele entra na frota depois de aceitar.';

@Injectable()
export class EntregadorService {
  constructor(
    private readonly entregadores: EntregadorRepository,
    private readonly contratos: ContratoRepository,
    private readonly senha: SenhaService,
  ) {}

  async cadastrar(idEmpresa: number, dto: CadastrarEntregadorDto) {
    const existente = await this.entregadores.procurarPorCpf(dto.cpf);
    if (existente) {
      throw this.cpfJaCadastrado();
    }
    const senhaTemporaria = this.gerarSenhaTemporaria();
    const senhaHash = await this.senha.hash(senhaTemporaria);
    let entregador: Entregador;
    try {
      entregador = await this.entregadores.criarComConvite(
        {
          nome: dto.nome,
          cpf: dto.cpf,
          telefone: dto.telefone,
          tipoVeiculo: dto.tipoVeiculo,
          placa:
            dto.tipoVeiculo === TipoVeiculo.BICICLETA
              ? null
              : (dto.placa ?? null),
          senhaHash,
        },
        idEmpresa,
      );
    } catch (erro) {
      if (violouUnicidade(erro)) {
        throw this.cpfJaCadastrado();
      }
      throw erro;
    }

    // Dados digitados pela propria empresa: nao expoe nada novo antes do aceite.
    return {
      entregador: {
        cpf: entregador.cpf,
        nome: entregador.nome,
        tipoVeiculo: entregador.tipo_veiculo,
        placa: entregador.placa,
      },
      status: StatusContrato.PENDENTE,
      senhaTemporaria,
    };
  }

  // Mesma resposta para CPF cadastrado, inexistente ou ja convidado, para nao
  // revelar quem e entregador na plataforma.
  async convidar(idEmpresa: number, cpf: string) {
    const entregador = await this.entregadores.procurarPorCpf(cpf);
    if (entregador) {
      try {
        await this.contratos.criarConvite(idEmpresa, entregador.cpf);
      } catch (erro) {
        if (!violouUnicidade(erro)) {
          throw erro;
        }
      }
    }
    return { mensagem: MENSAGEM_CONVITE };
  }

  async listarFrota(idEmpresa: number) {
    const entregadores =
      await this.entregadores.procurarAtivosPorEmpresa(idEmpresa);
    return entregadores.map(dadosVisiveisParaEmpresa);
  }

  async desvincular(idEmpresa: number, cpf: string) {
    const encerrado = await this.contratos.encerrarPelaEmpresa(idEmpresa, cpf);
    if (!encerrado) {
      throw new NotFoundException('Entregador nao esta na sua frota');
    }
  }

  private cpfJaCadastrado() {
    return new ConflictException(
      'Entregador ja cadastrado na plataforma; envie um convite pelo CPF',
    );
  }

  private gerarSenhaTemporaria(): string {
    return randomBytes(9).toString('base64url');
  }
}
