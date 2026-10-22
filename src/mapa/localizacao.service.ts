import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { LocalizacaoEntrega } from '../generated/prisma/client';
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
  Trajeto,
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

export interface PosicaoRecebida extends Coordenada {
  precisao?: number;
}

const STATUS_ENCERRADOS: readonly StatusPedido[] = [
  StatusPedido.FINALIZADO,
  StatusPedido.CANCELADO,
];

// Endereco (do pedido ou da empresa) que o Google nao encontrou so e tentado
// de novo depois disso.
const ESPERA_NOVA_GEOCODIFICACAO_MS = 5 * 60_000;

// O front envia uma posicao a cada 5 s; mais rapido que isso, a posicao e
// ignorada sem gravar nem publicar (protege banco, socket e cota do Google).
export const INTERVALO_MINIMO_POSICAO_MS = 2_000;

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

  // E-US13: a empresa ve o mesmo mapa do entregador, so dos proprios pedidos.
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

  // Chamado depois da troca de status. Entrega encerrada apaga a posicao e
  // desconecta o recebedor. Falha aqui nao desfaz a troca de status.
  async aoMudarStatus(
    idPedido: number,
    status: StatusPedido,
    agora = new Date(),
  ): Promise<void> {
    try {
      // O horario entra na linha do tempo do recebedor (R-US02).
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

  // A posicao era do entregador anterior: o novo comeca do zero.
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

  // Entrega encerrada nao gasta geocodificacao: devolve o que ja existe.
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
      chaveDoPedido(pedido.id_pedido),
      destinoDoPedido(pedido),
      pedido,
      (coordenada) =>
        this.localizacoes.salvarDestino(pedido.id_pedido, coordenada),
      agora,
    );
    const origem = await this.geocodificarUmaVez(
      `empresa:${empresa.id_empresa}`,
      origemDaEmpresa(pedido),
      { ...empresa, uf: empresa.UF },
      (coordenada) =>
        this.localizacoes.salvarOrigem(empresa.id_empresa, coordenada),
      agora,
    );
    return { status: pedido.status, origem, destino };
  }

  // Cada endereco e geocodificado uma vez e a coordenada fica gravada.
  private async geocodificarUmaVez(
    chave: string,
    salva: Coordenada | null,
    endereco: EnderecoDoPedido,
    gravar: (coordenada: Coordenada) => Promise<void>,
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

  // Tres casos: recalcular no Google (com estimativa se ele falhar), manter a
  // ultima rota do Google, ou estimar em linha reta sem custo.
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

    const anterior = pedido.localizacao;
    const tipoVeiculo = pedido.entregador?.tipo_veiculo ?? '';
    const estimativa = () => estimarTrajeto(posicao, destino, tipoVeiculo);

    if (
      this.maps.habilitado &&
      deveRecalcularRota(ultimoCalculo(anterior), posicao, agora)
    ) {
      const rota = await this.maps.calcularRota(
        posicao,
        destino,
        modoDeViagem(tipoVeiculo),
      );
      return {
        ...base,
        ...trajeto(rota ?? estimativa(), rota?.polyline ?? null, !rota),
        origem_rota_lat: posicao.lat,
        origem_rota_lng: posicao.lng,
        rota_calculada_em: agora,
      };
    }

    if (this.maps.habilitado && anterior && !anterior.estimado) {
      return { ...base, ...dadosDaRota(anterior) };
    }

    return {
      ...base,
      ...trajeto(estimativa(), null, true),
      origem_rota_lat: anterior?.origem_rota_lat ?? posicao.lat,
      origem_rota_lng: anterior?.origem_rota_lng ?? posicao.lng,
      rota_calculada_em: anterior?.rota_calculada_em ?? null,
    };
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

const SEM_TRAJETO = {
  origem_rota_lat: null,
  origem_rota_lng: null,
  rota_polyline: null,
  distancia_restante_m: null,
  duracao_restante_s: null,
  estimado: true,
  rota_calculada_em: null,
};

// Vale tambem quando o Google falhou (estimado): a espera entre tentativas
// continua contando a partir de rota_calculada_em.
function ultimoCalculo(anterior: LocalizacaoEntrega | null) {
  if (!anterior) {
    return null;
  }
  const origem =
    anterior.origem_rota_lat !== null && anterior.origem_rota_lng !== null
      ? { lat: anterior.origem_rota_lat, lng: anterior.origem_rota_lng }
      : null;
  return { origem, calculadoEm: anterior.rota_calculada_em };
}

function trajeto(valores: Trajeto, polyline: string | null, estimado: boolean) {
  return {
    rota_polyline: polyline,
    distancia_restante_m: valores.distanciaM,
    duracao_restante_s: valores.duracaoS,
    estimado,
  };
}

function dadosDaRota(anterior: LocalizacaoEntrega) {
  return {
    origem_rota_lat: anterior.origem_rota_lat,
    origem_rota_lng: anterior.origem_rota_lng,
    rota_polyline: anterior.rota_polyline,
    distancia_restante_m: anterior.distancia_restante_m,
    duracao_restante_s: anterior.duracao_restante_s,
    estimado: anterior.estimado,
    rota_calculada_em: anterior.rota_calculada_em,
  };
}
