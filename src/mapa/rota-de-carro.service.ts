import { Injectable } from '@nestjs/common';
import { coordenada, destinoDoPedido } from './dto/visao-da-entrega.dto';
import { EnderecoLocalizado } from './escolha-do-geocoding';
import { Coordenada, estimarTrajeto, ModoDeViagem, modoDeViagem } from './geo';
import { EnderecoDoPedido, GoogleMapsClient } from './google-maps.client';
import { LocalizacaoRepository, PedidoComMapa } from './localizacao.repository';

export interface RotaAteORecebedor {
  distanciaM: number;
  destino: Coordenada;
}

@Injectable()
export class RotaDeCarroService {
  constructor(
    private readonly maps: GoogleMapsClient,
    private readonly localizacoes: LocalizacaoRepository,
  ) {}

  async calcular(
    idEmpresa: number,
    enderecoDoRecebedor: EnderecoDoPedido,
    modo: ModoDeViagem = 'DRIVE',
    destinoInformado: Coordenada | null = null,
  ): Promise<RotaAteORecebedor | null> {
    const origem = await this.origemDaEmpresa(idEmpresa);
    if (!origem) {
      return null;
    }
    const destino =
      destinoInformado ??
      (this.maps.habilitado
        ? await this.maps.geocodificar(enderecoDoRecebedor)
        : null);
    if (!destino) {
      return null;
    }
    const rota = this.maps.habilitado
      ? await this.maps.calcularRota(origem, destino, modo)
      : null;
    return {
      distanciaM:
        rota?.distanciaM ?? estimarTrajeto(origem, destino, modo).distanciaM,
      destino,
    };
  }

  localizarEndereco(
    endereco: EnderecoDoPedido,
  ): Promise<EnderecoLocalizado | null> {
    return this.maps.localizar(endereco);
  }

  async distanciaParaFinalizar(idPedido: number): Promise<number | null> {
    const pedido = await this.localizacoes.procurarPorId(idPedido);
    if (!pedido) {
      return null;
    }
    const origem = await this.origemDaEmpresa(pedido.empresa.id_empresa);
    const destino = await this.destinoParaFinalizar(pedido);
    if (!origem || !destino) {
      return null;
    }
    const tipoVeiculo = pedido.entregador?.tipo_veiculo ?? '';
    const rota = await this.maps.calcularRota(
      origem,
      destino,
      modoDeViagem(tipoVeiculo),
    );
    return (
      rota?.distanciaM ??
      estimarTrajeto(origem, destino, tipoVeiculo).distanciaM
    );
  }

  private async destinoParaFinalizar(
    pedido: PedidoComMapa,
  ): Promise<Coordenada | null> {
    const salvo = destinoDoPedido(pedido);
    if (salvo) {
      return salvo;
    }
    const { localizacao } = pedido;
    if (localizacao) {
      return { lat: localizacao.lat, lng: localizacao.lng };
    }
    return this.maps.geocodificar(pedido);
  }

  private async origemDaEmpresa(idEmpresa: number): Promise<Coordenada | null> {
    const empresa = await this.localizacoes.procurarEmpresa(idEmpresa);
    if (!empresa) {
      return null;
    }
    const salva = coordenada(empresa.origem_lat, empresa.origem_lng);
    if (salva) {
      return salva;
    }
    const origem = await this.maps.geocodificar({ ...empresa, uf: empresa.UF });
    if (origem) {
      await this.localizacoes.salvarOrigem(idEmpresa, origem);
    }
    return origem;
  }
}
