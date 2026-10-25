import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EntregadorRepository } from '../entregador/entregador.repository';
import { Pedido } from '../generated/prisma/client';
import { StatusPedido } from '../generated/prisma/enums';
import { LocalizacaoService } from '../mapa/localizacao.service';
import { ConversaWhatsappDto } from './dto/conversa-whatsapp.dto';
import {
  CodigoDoRecebedorService,
  ConferenciaDoCodigo,
} from '../rastreio/codigo-do-recebedor.service';
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
  exigeCodigoDoRecebedor,
  obterStatusDisponiveis,
  statusFinal,
  transicaoPermitida,
} from './regras/status-pedido.regra';
import {
  DadosDaConversa,
  montarLinkWhatsapp,
  textoDaEmpresaParaEntregador,
  textoDaEmpresaParaRecebedor,
  textoDoEntregadorParaEmpresa,
} from './whatsapp';

import {
  DetalheDoPedidoDto,
  paraDetalheDoPedido,
} from './dto/detalhe-do-pedido.dto';

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
    private readonly codigoDoRecebedor: CodigoDoRecebedorService,
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

  async corrigir_distancia(
    id_empresa: number,
    id_pedido: number,
    distancia_metros: number,
  ): Promise<PedidoResumoDto> {
    const pedido = await this.pedidoRepository.procurarPorEmpresa(
      id_pedido,
      id_empresa,
    );
    if (!pedido) throw new NotFoundException('Pedido não encontrado');
    if (
      !STATUS_REATRIBUIVEIS.includes(pedido.status) ||
      pedido.ganho_consolidado_centavos != null
    ) {
      throw new ConflictException(
        'A distância só pode ser corrigida antes da conclusão da entrega',
      );
    }
    const pedido_atualizado = await this.comControleDeConcorrencia(() =>
      this.pedidoRepository.corrigir_distancia(
        id_pedido,
        id_empresa,
        distancia_metros,
      ),
    );
    return paraPedidoResumo(pedido_atualizado);
  }

  async detalhar(
    idEmpresa: number,
    idPedido: number,
  ): Promise<DetalheDoPedidoDto> {
    const pedido = await this.pedidoRepository.procurarDetalheDaEmpresa(
      idPedido,
      idEmpresa,
    );
    if (!pedido) {
      throw new NotFoundException('Pedido não encontrado');
    }
    return paraDetalheDoPedido(pedido);
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
    const pedido = await this.exigirPedidoDoEntregador(cpfEntregador, idPedido);
    if (exigeCodigoDoRecebedor(novoStatus)) {
      throw new ConflictException(
        'Para finalizar a entrega, informe o código do recebedor',
      );
    }
    exigirTransicao(pedido, novoStatus);
    return this.aplicarStatus(cpfEntregador, pedido, novoStatus);
  }

  async finalizar(
    cpfEntregador: string,
    idPedido: number,
    codigo: string,
  ): Promise<PedidoResumoDto> {
    const pedido = await this.exigirPedidoDoEntregador(cpfEntregador, idPedido);
    exigirTransicao(pedido, StatusPedido.FINALIZADO);
    exigirCodigoCorreto(
      await this.codigoDoRecebedor.conferir(idPedido, codigo),
    );
    return this.aplicarStatus(cpfEntregador, pedido, StatusPedido.FINALIZADO);
  }

  async obterStatusDisponiveis(cpfEntregador: string, idPedido: number) {
    const pedido = await this.exigirPedidoDoEntregador(cpfEntregador, idPedido);
    return {
      statusAtual: pedido.status,
      statusDisponiveis: obterStatusDisponiveis(pedido.status),
      podeFinalizarComCodigo: transicaoPermitida(
        pedido.status,
        StatusPedido.FINALIZADO,
      ),
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

    return this.trocarEntregador(idEmpresa, pedido, cpfNovoEntregador);
  }

  // E-US08: so o primeiro entregador. Trocar quem ja esta no pedido e a
  // reatribuicao (E-US11), que registra o entregador anterior.
  async atribuir(
    idEmpresa: number,
    idPedido: number,
    cpfEntregador: string,
  ): Promise<PedidoResumoDto> {
    const pedido = await this.pedidoRepository.procurarPorEmpresa(
      idPedido,
      idEmpresa,
    );

    if (!pedido) {
      throw new NotFoundException('Pedido não encontrado');
    }

    if (pedido.status !== StatusPedido.PENDENTE || pedido.cpf_entregador) {
      throw new ConflictException(
        'Só é possível atribuir um pedido pendente e sem entregador',
      );
    }

    return this.trocarEntregador(idEmpresa, pedido, cpfEntregador);
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
        textoDaEmpresaParaEntregador(dados),
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
        textoDoEntregadorParaEmpresa(dados),
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
        textoDaEmpresaParaRecebedor({
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

  private async trocarEntregador(
    idEmpresa: number,
    pedido: Pedido,
    cpfNovoEntregador: string,
  ): Promise<PedidoResumoDto> {
    const idPedido = pedido.id_pedido;

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

  // Vinculo ATIVO: a empresa so atribui entregador da propria frota.
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

  private async exigirPedidoDoEntregador(
    cpfEntregador: string,
    idPedido: number,
  ): Promise<Pedido> {
    const pedido = await this.pedidoRepository.procurarAtribuidoAoEntregador(
      idPedido,
      cpfEntregador,
    );
    if (!pedido) {
      throw new NotFoundException('Pedido não encontrado');
    }
    return pedido;
  }

  private async aplicarStatus(
    cpfEntregador: string,
    pedido: Pedido,
    novoStatus: StatusPedido,
  ): Promise<PedidoResumoDto> {
    const atualizado = await this.comControleDeConcorrencia(() =>
      this.pedidoRepository.atualizarStatus({
        idPedido: pedido.id_pedido,
        cpfEntregador,
        statusAtual: pedido.status,
        novoStatus,
        finalizar: statusFinal(novoStatus),
      }),
    );
    await this.localizacao.aoMudarStatus(pedido.id_pedido, novoStatus);
    return paraPedidoResumo(atualizado);
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

function exigirTransicao(pedido: Pedido, novoStatus: StatusPedido): void {
  if (!transicaoPermitida(pedido.status, novoStatus)) {
    throw new ConflictException(
      `Não é permitido alterar o pedido de ${pedido.status} para ${novoStatus}`,
    );
  }
}

function exigirCodigoCorreto(conferencia: ConferenciaDoCodigo): void {
  switch (conferencia.situacao) {
    case 'correto':
      return;
    case 'sem_codigo':
      throw new ConflictException(
        'O recebedor ainda não tem o código: peça à empresa para enviar o link de rastreio',
      );
    case 'bloqueado':
      throw new HttpException(
        {
          message: 'Muitas tentativas erradas. Tente de novo mais tarde',
          liberaEm: conferencia.liberaEm,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    case 'incorreto':
      throw new UnprocessableEntityException({
        message: 'Código incorreto',
        tentativasRestantes: conferencia.tentativasRestantes,
      });
  }
}
