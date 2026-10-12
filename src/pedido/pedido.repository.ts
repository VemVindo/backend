import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Pedido } from '../generated/prisma/client';
import { CriaPedidoReqDto } from './dto/cria-pedido.dto';

@Injectable()
export class PedidoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async criar(pedido: CriaPedidoReqDto): Promise<Pedido> {
    return await this.prisma.pedido.create({
      data: {
        nome_recebedor: pedido.nome_recebedor,
        telefone_recebedor: pedido.telefone_recebedor,
        cep: pedido.cep,
        logradouro: pedido.logradouro,
        numero: pedido.numero,
        complemento: pedido.complemento,
        bairro: pedido.bairro,
        cidade: pedido.cidade,
        uf: pedido.uf,
        descricao: pedido.descricao,
        status: pedido.status,
        data_criacao: pedido.data_criacao,
        valor_entrega: pedido.valor_entrega,
        idEmpresa: pedido.idEmpresa,
        distancia: pedido.distancia,
        cpf_entregador: pedido.cpf_entregador,
      },
    });
  }
}
