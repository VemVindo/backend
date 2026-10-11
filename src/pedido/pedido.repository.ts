import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Pedido } from '../generated/prisma/client';
import { PedidoDto } from './dto/pedido.dto';

@Injectable()
export class PedidoRepository {
  constructor(private readonly prisma: PrismaService) {};

  async criar(pedidoDto: PedidoDto): Promise<Pedido> {
    return await this.prisma.pedido.create({
      data: {
        nome_recebedor: pedidoDto.nome_recebedor,
        telefone_recebedor: pedidoDto.telefone_recebedor,
        cep: pedidoDto.cep,
        logradouro: pedidoDto.logradouro,
        numero: pedidoDto.numero,
        complemento: pedidoDto.complemento,
        bairro: pedidoDto.bairro,
        cidade: pedidoDto.cidade,
        uf: pedidoDto.uf,
        descricao: pedidoDto.descricao,
        status: pedidoDto.status!,
        data_criacao: pedidoDto.data_criacao!,
        valor_entrega: pedidoDto.valor_entrega,
        idEmpresa: pedidoDto.idEmpresa,
        distancia: pedidoDto.distancia,
        cpf_entregador: pedidoDto.cpf_entregador,
      },
    });
  }
}
