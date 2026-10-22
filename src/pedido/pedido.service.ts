import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EntregadorRepository } from '../entregador/entregador.repository';
import { Pedido } from '../generated/prisma/client';
import { StatusPedido } from '../generated/prisma/enums';
import { LocalizacaoService } from '../mapa/localizacao.service';
import { ConversaWhatsappDto } from './dto/conversa-whatsapp.dto';
import { CriaPedidoReqDto } from './dto/cria-pedido.dto';
import {
  HistoricoEntregadorDto,
  paraHistoricoEntregador,
} from './dto/historico-entregador.dto';
import {
  paraPedidoDoEntregador,
  PedidoDoEntregadorDto,
} from './dto/pedido-do-entregador.dto';
import { paraPedidoResumo, PedidoResumoDto } from './dto/pedido-resumo.dto';
import { StatusFactory } from './factories/status.factory';
import {
  EntregadorIndisponivelError,
  PedidoAlteradoError,
} from './pedido.erros';
import {
  DonoDoPedido,
  PedidoComContatos,
  PedidoRepository,
} from './pedido.repository';
import {
  obterStatusDisponiveis,
  statusFinal,
  transicaoPermitida,
} from './regras/status-pedido.regra';
import {
  DadosDaConversa,
  montarLinkWhatsapp,
  textoParaEntregador,
  textoParaEstabelecimento,
  textoParaRecebedor,
} from './whatsapp';

const STATUS_REATRIBUIVEIS: readonly StatusPedido[] = [
  StatusPedido.PENDENTE,
  StatusPedido.EM_ANDAMENTO,
];

const STATUS_COM_CONVERSA_DO_RECEBEDOR: readonly StatusPedido[] = [
  StatusPedido.PENDENTE,
  StatusPedido.EM_ANDAMENTO,
];

@Injectable()
export class PedidoService {
  constructor(
    private readonly pedidoRepository: PedidoRepository,
    private readonly entregadorRepository: EntregadorRepository,
    private readonly localizacao: LocalizacaoService,
  ) {}

  async criar(idEmpresa: number, pedido: CriaPedidoReqDto): Promise<Pedido> {
    if (pedido.cpf_entregador) {
      await this.exigirEntregadorDisponivel(idEmpresa, pedido.cpf_entregador);
    }

    pedido.status = StatusFactory.criar(pedido.cpf_entregador);
    pedido.data_criacao = new Date().toISOString();
    return this.comControleDeConcorrencia(() =>
      this.pedidoRepository.criar(pedido, idEmpresa),
    );
  }

  async listarDaEmpresa(idEmpresa: number): Promise<PedidoResumoDto[]> {
    const pedidos = await this.pedidoRepository.listarDaEmpresa(idEmpresa);
    return pedidos.map(paraPedidoResumo);
  }

  async listarDoEntregador(
    cpfEntregador: string,
  ): Promise<PedidoDoEntregadorDto[]> {
    const pedidos =
      await this.pedidoRepository.listarDoEntregador(cpfEntregador);
    return pedidos.map(paraPedidoDoEntregador);
  }

  async atualizarStatus(
    cpfEntregador: string,
    idPedido: number,
    novoStatus: StatusPedido,
  ): Promise<PedidoResumoDto> {
    const pedido = await this.pedidoRepository.procurarAtribuidoAoEntregador(
      idPedido,
      cpfEntregador,
    );

    if (!pedido) {
      throw new NotFoundException('Pedido não encontrado');
    }

    if (!transicaoPermitida(pedido.status, novoStatus)) {
      throw new ConflictException(
        `Não é permitido alterar o pedido de ${pedido.status} para ${novoStatus}`,
      );
    }

    const atualizado = await this.comControleDeConcorrencia(() =>
      this.pedidoRepository.atualizarStatus({
        idPedido,
        cpfEntregador,
        statusAtual: pedido.status,
        novoStatus,
        finalizar: statusFinal(novoStatus),
      }),
    );

    await this.localizacao.aoMudarStatus(idPedido, novoStatus);
    return paraPedidoResumo(atualizado);
  }

  async obterStatusDisponiveis(cpfEntregador: string, idPedido: number) {
    const pedido = await this.pedidoRepository.procurarAtribuidoAoEntregador(
      idPedido,
      cpfEntregador,
    );

    if (!pedido) {
      throw new NotFoundException('Pedido não encontrado');
    }

    return {
      statusAtual: pedido.status,
      statusDisponiveis: obterStatusDisponiveis(pedido.status),
    };
  }

  async reatribuir(
    idEmpresa: number,
    idPedido: number,
    cpfNovoEntregador: string,
  ): Promise<PedidoResumoDto> {
    const pedido = await this.pedidoRepository.procurarPorEmpresa(
      idPedido,
      idEmpresa,
    );

    if (!pedido) {
      throw new NotFoundException('Pedido não encontrado');
    }

    if (!STATUS_REATRIBUIVEIS.includes(pedido.status)) {
      throw new ConflictException(
        'Pedido não pode ser reatribuído no status atual',
      );
    }

    if (pedido.cpf_entregador === cpfNovoEntregador) {
      throw new ConflictException(
        'O entregador informado já está atribuído ao pedido',
      );
    }

    await this.exigirEntregadorDisponivel(idEmpresa, cpfNovoEntregador);

    const reatribuido = await this.comControleDeConcorrencia(() =>
      this.pedidoRepository.reatribuir({
        idPedido,
        statusAtual: pedido.status,
        cpfAnterior: pedido.cpf_entregador,
        cpfNovo: cpfNovoEntregador,
      }),
    );

    await this.localizacao.aoTrocarEntregador(idPedido);
    if (pedido.status !== reatribuido.status) {
      await this.localizacao.aoMudarStatus(idPedido, reatribuido.status);
    }
    return paraPedidoResumo(reatribuido);
  }

  async listarHistoricoDeEntregadores(
    idEmpresa: number,
    idPedido: number,
  ): Promise<HistoricoEntregadorDto[]> {
    const pedido = await this.pedidoRepository.procurarPorEmpresa(
      idPedido,
      idEmpresa,
    );

    if (!pedido) {
      throw new NotFoundException('Pedido não encontrado');
    }

    const registros =
      await this.pedidoRepository.listarHistoricoDeEntregadores(idPedido);
    return registros.map(paraHistoricoEntregador);
  }

  async conversaComEntregador(
    idEmpresa: number,
    idPedido: number,
  ): Promise<ConversaWhatsappDto> {
    const { pedido, dados } = await this.prepararConversa(idPedido, {
      idEmpresa,
    });
    return {
      link: this.exigirLink(
        pedido.entregador.telefone,
        textoParaEntregador(dados),
      ),
      contato: dados.entregador,
    };
  }

  async conversaComEstabelecimento(
    cpfEntregador: string,
    idPedido: number,
  ): Promise<ConversaWhatsappDto> {
    const { pedido, dados } = await this.prepararConversa(idPedido, {
      cpf_entregador: cpfEntregador,
    });
    return {
      link: this.exigirLink(
        pedido.empresa.telefone,
        textoParaEstabelecimento(dados),
      ),
      contato: dados.empresa,
    };
  }

  async conversaComRecebedor(
    idEmpresa: number,
    idPedido: number,
  ): Promise<ConversaWhatsappDto> {
    const pedido = await this.pedidoRepository.procurarComContatos(idPedido, {
      idEmpresa,
    });
    if (!pedido) {
      throw new NotFoundException('Pedido não encontrado');
    }
    if (!STATUS_COM_CONVERSA_DO_RECEBEDOR.includes(pedido.status)) {
      throw new ConflictException(
        'A conversa com o recebedor só fica disponível enquanto o pedido está aberto',
      );
    }
    return {
      link: this.exigirLink(
        pedido.telefone_recebedor,
        textoParaRecebedor({
          idPedido: pedido.id_pedido,
          empresa: pedido.empresa.nome_fantasia,
          recebedor: pedido.nome_recebedor,
        }),
      ),
      contato: pedido.nome_recebedor,
    };
  }

  private async prepararConversa(idPedido: number, dono: DonoDoPedido) {
    const pedido = await this.pedidoRepository.procurarComContatos(
      idPedido,
      dono,
    );
    if (!pedido) {
      throw new NotFoundException('Pedido não encontrado');
    }
    if (!conversaDisponivel(pedido)) {
      throw new ConflictException(
        'A conversa pelo WhatsApp só fica disponível com a entrega em andamento',
      );
    }

    const dados: DadosDaConversa = {
      idPedido: pedido.id_pedido,
      empresa: pedido.empresa.nome_fantasia,
      entregador: pedido.entregador.nome,
    };
    return { pedido, dados };
  }

  private exigirLink(telefone: string, texto: string): string {
    const link = montarLinkWhatsapp(telefone, texto);
    if (!link) {
      throw new UnprocessableEntityException(
        'O telefone cadastrado não é válido para o WhatsApp',
      );
    }
    return link;
  }

  private async exigirEntregadorDisponivel(
    idEmpresa: number,
    cpfEntregador: string,
  ): Promise<void> {
    const entregador = await this.entregadorRepository.procurarAtivoPorEmpresa(
      idEmpresa,
      cpfEntregador,
    );

    if (!entregador) {
      throw new NotFoundException(
        'Entregador não encontrado na frota da empresa',
      );
    }

    if (!entregador.disponivel) {
      throw new ConflictException('Entregador não está disponível');
    }
  }

  private async comControleDeConcorrencia<T>(
    escrita: () => Promise<T>,
  ): Promise<T> {
    try {
      return await escrita();
    } catch (erro) {
      if (erro instanceof PedidoAlteradoError) {
        throw new ConflictException(
          'O pedido foi alterado por outra operação; atualize e tente novamente',
        );
      }
      if (erro instanceof EntregadorIndisponivelError) {
        throw new ConflictException('Entregador não está disponível');
      }
      throw erro;
    }
  }
}

type PedidoEmConversa = PedidoComContatos & {
  entregador: NonNullable<PedidoComContatos['entregador']>;
};

function conversaDisponivel(
  pedido: PedidoComContatos,
): pedido is PedidoEmConversa {
  return pedido.status === StatusPedido.EM_ANDAMENTO && !!pedido.entregador;
}
