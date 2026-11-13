import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TipoVeiculo } from '../common/enums/tipo-veiculo.enum';
import { Entregador } from '../generated/prisma/client';
import { EditarPerfilDto } from './dto/editar-perfil.dto';
import { EntregadorRepository } from './entregador.repository';

export const MENSAGEM_PLACA_OBRIGATORIA = 'placa obrigatoria para MOTO e CARRO';

export interface PerfilDoEntregador {
  nome: string;
  cpf: string;
  telefone: string;
  tipoVeiculo: string;
  placa: string | null;
}

function perfil(entregador: Entregador): PerfilDoEntregador {
  return {
    nome: entregador.nome,
    cpf: entregador.cpf,
    telefone: entregador.telefone,
    tipoVeiculo: entregador.tipo_veiculo,
    placa: entregador.placa,
  };
}

// O cadastro do entregador e um so para todas as empresas, por isso so ele
// mesmo edita (EN-US08). O CPF vem sempre do token.
@Injectable()
export class PerfilEntregadorService {
  constructor(private readonly entregadores: EntregadorRepository) {}

  async consultar(cpf: string): Promise<PerfilDoEntregador> {
    return perfil(await this.cadastroDe(cpf));
  }

  async editar(
    cpf: string,
    dados: EditarPerfilDto,
  ): Promise<PerfilDoEntregador> {
    const atual = await this.cadastroDe(cpf);
    const tipoVeiculo: string = dados.tipoVeiculo ?? atual.tipo_veiculo;
    const bicicleta = tipoVeiculo === String(TipoVeiculo.BICICLETA);
    const placa = bicicleta ? null : (dados.placa ?? atual.placa);
    if (!bicicleta && !placa) {
      throw new BadRequestException(MENSAGEM_PLACA_OBRIGATORIA);
    }
    const gravado = await this.entregadores.atualizarPerfil(cpf, {
      nome: dados.nome,
      telefone: dados.telefone,
      tipo_veiculo: tipoVeiculo,
      placa,
    });
    return perfil(gravado);
  }

  private async cadastroDe(cpf: string): Promise<Entregador> {
    const entregador = await this.entregadores.procurarPorCpf(cpf);
    if (!entregador) throw new NotFoundException('Entregador nao encontrado');
    return entregador;
  }
}
