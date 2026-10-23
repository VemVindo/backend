import { Injectable } from '@nestjs/common';
import { coordenada } from './dto/visao-da-entrega.dto';
import { Coordenada } from './geo';
import { EnderecoDoPedido, GoogleMapsClient } from './google-maps.client';
import { LocalizacaoRepository } from './localizacao.repository';

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
  ): Promise<RotaAteORecebedor | null> {
    if (!this.maps.habilitado) {
      return null;
    }
    const origem = await this.origemDaEmpresa(idEmpresa);
    if (!origem) {
      return null;
    }
    const destino = await this.maps.geocodificar(enderecoDoRecebedor);
    if (!destino) {
      return null;
    }
    const rota = await this.maps.calcularRota(origem, destino, 'DRIVE');
    return rota && { distanciaM: rota.distanciaM, destino };
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
