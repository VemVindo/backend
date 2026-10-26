import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntregadorRepository } from '../entregador/entregador.repository';
import { Pedido } from '../generated/prisma/client';
import { StatusPedido } from '../generated/prisma/enums';
import { LocalizacaoService } from '../mapa/localizacao.service';
import { CodigoDoRecebedorService } from '../rastreio/codigo-do-recebedor.service';
import { CriarPedidoDto } from './dto/criar-pedido.dto';
import {
  HistoricoEntregadorDto,
  paraHistoricoEntregador,
} from './dto/historico-entregador.dto';
import {
  paraPedidoDoEntregador,
  PedidoDoEntregadorDto,
} from './dto/pedido-do-entregador.dto';
import { paraPedidoResumo, PedidoResumoDto } from './dto/pedido-resumo.dto';
import { exigirCodigoCorreto, exigirTransicao } from './exigencias-do-pedido';
import { StatusFactory } from './factories/status.factory';
import {
  EntregadorIndisponivelError,
  PedidoAlteradoError,
} from './pedido.erros';
import { PedidoRepository } from './pedido.repository';
import {
  exigeCodigoDoRecebedor,
  obterStatusDisponiveis,
  statusFinal,
  transicaoPermitida,
} from './regras/status-pedido.regra';
import {
  DetalheDoPedidoDto,
  paraDetalheDoPedido,
} from './dto/detalhe-do-pedido.dto';
import {
  ParametrosRemuneracao,
  RemuneracaoService,
} from '../remuneracao/remuneracao.service';
import { CalculoValorEntregaService } from '../remuneracao/calculo-valor-entrega.service';
import { GoogleMapsClient } from '../mapa/google-maps.client';
import { Coordenada } from '../mapa/geo';

const STATUS_REATRIBUIVEIS: readonly StatusPedido[] = [
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
    private readonly remuneracaoService: RemuneracaoService,
    private readonly calculoValorEntregaService: CalculoValorEntregaService,
    private readonly googleMapsClient: GoogleMapsClient,
  ) {}

  async criar(idEmpresa: number, pedido: CriarPedidoDto): Promise<Pedido> {
    if (pedido.cpf_entregador) {
      await this.exigirEntregadorDisponivel(idEmpresa, pedido.cpf_entregador);
    }

    const { taxaFixa, coeficienteKm }: ParametrosRemuneracao =
      await this.remuneracaoService.consultar(idEmpresa);
    if (taxaFixa == null || coeficienteKm == null) {
      throw new ConflictException(
        'Parâmetros de remuneração não configurados.',
      );
    }
    const coordenadaOrigem: Coordenada = {
      lat: pedido.lat_origem,
      lng: pedido.long_origem,
    };

    const coordenadaDestino: Coordenada = {
      lat: pedido.lat_destino,
      lng: pedido.long_destino,
    };

    const calculo = await this.googleMapsClient.calcularRota(
      coordenadaOrigem,
      coordenadaDestino,
      pedido.tipo_veiculo,
    );

    if (calculo == null)
      throw new ConflictException('Falha no calculo da rota');

    pedido.distancia = calculo.distanciaM;
    pedido.valor_entrega = this.calculoValorEntregaService.calcularValorEntrega(
      {
        distanciaMetros: pedido.distancia,
        taxaFixaCentavos: taxaFixa,
        coeficienteCentavosKm: coeficienteKm,
      },
    );
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

  async corrigirDistancia(
    idEmpresa: number,
    idPedido: number,
    distanciaMetros: number,
  ): Promise<PedidoResumoDto> {
    const pedido = await this.pedidoRepository.procurarPorEmpresa(
      idPedido,
      idEmpresa,
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
    const pedidoAtualizado = await this.comControleDeConcorrencia(() =>
      this.pedidoRepository.corrigirDistancia(
        idPedido,
        idEmpresa,
        distanciaMetros,
      ),
    );
    return paraPedidoResumo(pedidoAtualizado);
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
