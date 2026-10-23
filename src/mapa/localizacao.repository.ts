import { Injectable } from '@nestjs/common';
import { LocalizacaoEntrega, Pedido, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Coordenada } from './geo';

const CAMPOS_DA_EMPRESA = {
  id_empresa: true,
  exibir_mapa: true,
  origem_lat: true,
  origem_lng: true,
  cep: true,
  logradouro: true,
  numero: true,
  bairro: true,
  cidade: true,
  UF: true,
} satisfies Prisma.EmpresaSelect;

const DADOS_DO_MAPA = {
  empresa: { select: CAMPOS_DA_EMPRESA },
  entregador: { select: { tipo_veiculo: true } },
  localizacao: true,
} satisfies Prisma.PedidoInclude;

export interface EmpresaDoMapa {
  id_empresa: number;
  exibir_mapa: boolean;
  origem_lat: number | null;
  origem_lng: number | null;
  cep: string;
  logradouro: string;
  numero: number;
  bairro: string;
  cidade: string;
  UF: string;
}

export type PedidoComMapa = Pedido & {
  empresa: EmpresaDoMapa;
  entregador: { tipo_veiculo: string } | null;
  localizacao: LocalizacaoEntrega | null;
};

export type DadosDaPosicao = Omit<LocalizacaoEntrega, 'idPedido'>;

@Injectable()
export class LocalizacaoRepository {
  constructor(private readonly prisma: PrismaService) {}

  procurarDoEntregador(
    idPedido: number,
    cpfEntregador: string,
  ): Promise<PedidoComMapa | null> {
    return this.prisma.pedido.findFirst({
      where: { id_pedido: idPedido, cpf_entregador: cpfEntregador },
      include: DADOS_DO_MAPA,
    });
  }

  procurarDaEmpresa(
    idPedido: number,
    idEmpresa: number,
  ): Promise<PedidoComMapa | null> {
    return this.prisma.pedido.findFirst({
      where: { id_pedido: idPedido, idEmpresa },
      include: DADOS_DO_MAPA,
    });
  }

  procurarPorId(idPedido: number): Promise<PedidoComMapa | null> {
    return this.prisma.pedido.findUnique({
      where: { id_pedido: idPedido },
      include: DADOS_DO_MAPA,
    });
  }

  procurarEmpresa(idEmpresa: number): Promise<EmpresaDoMapa | null> {
    return this.prisma.empresa.findUnique({
      where: { id_empresa: idEmpresa },
      select: CAMPOS_DA_EMPRESA,
    });
  }

  async salvarDestino(idPedido: number, destino: Coordenada): Promise<void> {
    await this.prisma.pedido.update({
      where: { id_pedido: idPedido },
      data: { destino_lat: destino.lat, destino_lng: destino.lng },
    });
  }

  async salvarOrigem(idEmpresa: number, origem: Coordenada): Promise<void> {
    await this.prisma.empresa.update({
      where: { id_empresa: idEmpresa },
      data: { origem_lat: origem.lat, origem_lng: origem.lng },
    });
  }

  salvarPosicao(
    idPedido: number,
    dados: DadosDaPosicao,
  ): Promise<LocalizacaoEntrega> {
    return this.prisma.localizacaoEntrega.upsert({
      where: { idPedido },
      create: { idPedido, ...dados },
      update: dados,
    });
  }

  async apagarPosicao(idPedido: number): Promise<void> {
    await this.prisma.localizacaoEntrega.deleteMany({ where: { idPedido } });
  }
}
