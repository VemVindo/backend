import {
  ConflictException,
  HttpException,
  HttpStatus,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Pedido } from '../generated/prisma/client';
import { StatusPedido } from '../generated/prisma/enums';
import { ConferenciaDoCodigo } from '../rastreio/codigo-do-recebedor.service';
import { transicaoPermitida } from './regras/status-pedido.regra';

export function exigirTransicao(
  pedido: Pedido,
  novoStatus: StatusPedido,
): void {
  if (!transicaoPermitida(pedido.status, novoStatus)) {
    throw new ConflictException(
      `Não é permitido alterar o pedido de ${pedido.status} para ${novoStatus}`,
    );
  }
}

export function exigirCodigoCorreto(conferencia: ConferenciaDoCodigo): void {
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
