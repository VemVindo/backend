import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { StatusPedido } from '../generated/prisma/enums';
import {
  destinoDoPedido,
  montarVisao,
  origemDaEmpresa,
  PontosDaEntrega,
  VisaoDaEntrega,
  visaoDoRecebedor,
} from './dto/visao-da-entrega.dto';
import {
  Coordenada,
  deveRecalcularRota,
  estimarTrajeto,
  modoDeViagem,
} from './geo';
import { EnderecoDoPedido, GoogleMapsClient } from './google-maps.client';
import {
  DadosDaPosicao,
  LocalizacaoRepository,
  PedidoComMapa,
} from './localizacao.repository';
import {
  EVENTO_LOCALIZACAO,
  EVENTO_STATUS,
  RastreioGateway,
} from '../rastreio/rastreio.gateway';
import {
  dadosDaRota,
  SEM_TRAJETO,
  trajetoEstimado,
  TrajetoDaPosicao,
  trajetoRecalculado,
  ultimoCalculo,
} from './trajeto-da-posicao';

export interface PosicaoRecebida extends Coordenada {
  precisao?: number;
}

const STATUS_ENCERRADOS: readonly StatusPedido[] = [
  StatusPedido.FINALIZADO,
  StatusPedido.CANCELADO,
];

const ESPERA_NOVA_GEOCODIFICACAO_MS = 5 * 60_000;

export const INTERVALO_MINIMO_POSICAO_MS = 2_000;

interface Geocodificacao {
  chave: string;
  salva: Coordenada | null;
  endereco: EnderecoDoPedido;
  gravar: (coordenada: Coordenada) => Promise<void>;
}

@Injectable()
export class LocalizacaoService {
  private readonly logger = new Logger(LocalizacaoService.name);
  private readonly ultimaGeocodificacao = new Map<string, number>();

  constructor(
    private readonly localizacoes: LocalizacaoRepository,
    private readonly maps: GoogleMapsClient,
    private readonly gateway: RastreioGateway,
  ) {}

  async registrarPosicao(
    cpfEntregador: string,
    idPedido: number,
    posicao: PosicaoRecebida,
    agora = new Date(),
  ): Promise<VisaoDaEntrega> {
    const pedido = await this.pedidoDoEntregador(cpfEntregador, idPedido);
    if (pedido.status !== StatusPedido.EM_ANDAMENTO) {
      throw new ConflictException(
        'A localização só é compartilhada com a entrega em andamento',
      );
    }

    const anterior = pedido.localizacao;
    if (
      anterior &&
      agora.getTime() - anterior.registrada_em.getTime() <
        INTERVALO_MINIMO_POSICAO_MS
    ) {
      return montarVisao(pontosSalvos(pedido), anterior);
    }

    const pontos = await this.garantirPontos(pedido, agora);
    const dados = await this.calcularTrajeto(
      pedido,
      pontos.destino,
      posicao,
      agora,
    );
    const salva = await this.localizacoes.salvarPosicao(idPedido, dados);

    const visao = montarVisao(pontos, salva);
    this.gateway.publicar(
      idPedido,
      EVENTO_LOCALIZACAO,
      visaoDoRecebedor(visao, pedido.empresa.exibir_mapa),
    );
    return visao;
  }

  async consultarParaEntregador(
    cpfEntregador: string,
    idPedido: number,
  ): Promise<VisaoDaEntrega> {
    const pedido = await this.pedidoDoEntregador(cpfEntregador, idPedido);
    return this.visaoCompleta(pedido);
  }

  async consultarParaEmpresa(
    idEmpresa: number,
    idPedido: number,
  ): Promise<VisaoDaEntrega> {
    const pedido = await this.localizacoes.procurarDaEmpresa(
      idPedido,
      idEmpresa,
    );
    if (!pedido) {
      throw new NotFoundException('Pedido não encontrado');
    }
    return this.visaoCompleta(pedido);
  }

  async consultarParaRecebedor(idPedido: number): Promise<VisaoDaEntrega> {
    const pedido = await this.localizacoes.procurarPorId(idPedido);
    if (!pedido) {
      throw new NotFoundException('Pedido não encontrado');
    }
    return visaoDoRecebedor(
      montarVisao(pontosSalvos(pedido), pedido.localizacao),
      pedido.empresa.exibir_mapa,
    );
  }

  async aoMudarStatus(
    idPedido: number,
    status: StatusPedido,
    agora = new Date(),
  ): Promise<void> {
    try {
      this.gateway.publicar(idPedido, EVENTO_STATUS, { status, em: agora });
      if (STATUS_ENCERRADOS.includes(status)) {
        await this.localizacoes.apagarPosicao(idPedido);
        this.ultimaGeocodificacao.delete(chaveDoPedido(idPedido));
        this.gateway.encerrarSala(idPedido);
      }
    } catch (erro) {
      this.logger.error(
        `Falha ao encerrar o rastreio do pedido ${idPedido}`,
        erro,
      );
    }
  }

  async aoTrocarEntregador(idPedido: number): Promise<void> {
    try {
      await this.localizacoes.apagarPosicao(idPedido);
      const visao = await this.consultarParaRecebedor(idPedido);
      this.gateway.publicar(idPedido, EVENTO_LOCALIZACAO, visao);
    } catch (erro) {
      this.logger.error(
        `Falha ao reiniciar o rastreio do pedido ${idPedido}`,
        erro,
      );
    }
  }

  private async visaoCompleta(pedido: PedidoComMapa): Promise<VisaoDaEntrega> {
    const pontos =
      pedido.status === StatusPedido.EM_ANDAMENTO
        ? await this.garantirPontos(pedido, new Date())
        : pontosSalvos(pedido);
    return montarVisao(pontos, pedido.localizacao);
  }

  private async pedidoDoEntregador(
    cpfEntregador: string,
    idPedido: number,
  ): Promise<PedidoComMapa> {
    const pedido = await this.localizacoes.procurarDoEntregador(
      idPedido,
      cpfEntregador,
    );
    if (!pedido) {
      throw new NotFoundException('Pedido não encontrado');
    }
    return pedido;
  }

  private async garantirPontos(
    pedido: PedidoComMapa,
    agora: Date,
  ): Promise<PontosDaEntrega> {
    const { empresa } = pedido;
    const destino = await this.geocodificarUmaVez(
      {
        chave: chaveDoPedido(pedido.id_pedido),
        salva: destinoDoPedido(pedido),
        endereco: pedido,
        gravar: (coordenada) =>
          this.localizacoes.salvarDestino(pedido.id_pedido, coordenada),
      },
      agora,
    );
    const origem = await this.geocodificarUmaVez(
      {
        chave: `empresa:${empresa.id_empresa}`,
        salva: origemDaEmpresa(pedido),
        endereco: { ...empresa, uf: empresa.UF },
        gravar: (coordenada) =>
          this.localizacoes.salvarOrigem(empresa.id_empresa, coordenada),
      },
      agora,
    );
    return { status: pedido.status, origem, destino };
  }

  private async geocodificarUmaVez(
    { chave, salva, endereco, gravar }: Geocodificacao,
    agora: Date,
  ): Promise<Coordenada | null> {
    if (salva || !this.maps.habilitado) {
      return salva;
    }
    const tentativa = this.ultimaGeocodificacao.get(chave);
    if (
      tentativa !== undefined &&
      agora.getTime() - tentativa < ESPERA_NOVA_GEOCODIFICACAO_MS
    ) {
      return null;
    }
    this.ultimaGeocodificacao.set(chave, agora.getTime());
    const coordenada = await this.maps.geocodificar(endereco);
    if (coordenada) {
      await gravar(coordenada);
      this.ultimaGeocodificacao.delete(chave);
    }
    return coordenada;
  }

  private async calcularTrajeto(
    pedido: PedidoComMapa,
    destino: Coordenada | null,
    posicao: PosicaoRecebida,
    agora: Date,
  ): Promise<DadosDaPosicao> {
    const base = {
      lat: posicao.lat,
      lng: posicao.lng,
      precisao_m: posicao.precisao ?? null,
      registrada_em: agora,
    };
    if (!destino) {
      return { ...base, ...SEM_TRAJETO };
    }
    return {
      ...base,
      ...(await this.trajetoAte(pedido, destino, posicao, agora)),
    };
  }

  private async trajetoAte(
    pedido: PedidoComMapa,
    destino: Coordenada,
    posicao: Coordenada,
    agora: Date,
  ): Promise<TrajetoDaPosicao> {
    const anterior = pedido.localizacao;
    const tipoVeiculo = pedido.entregador?.tipo_veiculo ?? '';
    const estimativa = estimarTrajeto(posicao, destino, tipoVeiculo);

    if (!this.maps.habilitado) {
      return trajetoEstimado(estimativa, anterior, posicao);
    }
    if (deveRecalcularRota(ultimoCalculo(anterior), posicao, agora)) {
      const rota = await this.maps.calcularRota(
        posicao,
        destino,
        modoDeViagem(tipoVeiculo),
      );
      return trajetoRecalculado(rota, estimativa, posicao, agora);
    }
    if (anterior && !anterior.estimado) {
      return dadosDaRota(anterior);
    }
    return trajetoEstimado(estimativa, anterior, posicao);
  }
}

function chaveDoPedido(idPedido: number): string {
  return `pedido:${idPedido}`;
}

function pontosSalvos(pedido: PedidoComMapa): PontosDaEntrega {
  return {
    status: pedido.status,
    origem: origemDaEmpresa(pedido),
    destino: destinoDoPedido(pedido),
  };
}
