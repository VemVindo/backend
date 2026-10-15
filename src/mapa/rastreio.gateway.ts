import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import { RastreioService } from '../rastreio/rastreio.service';

export const EVENTO_LOCALIZACAO = 'localizacao';
export const EVENTO_STATUS = 'status';
export const EVENTO_ACESSO_NEGADO = 'acesso-negado';

export function salaDoPedido(idPedido: number): string {
  return `pedido:${idPedido}`;
}

// O recebedor so escuta: entra na sala do pedido com o token do link e recebe
// as posicoes que o entregador envia por HTTP. Sem @SubscribeMessage, nenhum
// evento do cliente e processado. O CORS vem do AdaptadorSocketIo (main.ts).
@WebSocketGateway({ namespace: '/rastreio' })
export class RastreioGateway implements OnGatewayConnection {
  private readonly logger = new Logger(RastreioGateway.name);

  @WebSocketServer()
  private readonly servidor?: Namespace;

  constructor(private readonly rastreio: RastreioService) {}

  async handleConnection(cliente: Socket): Promise<void> {
    const token: unknown = cliente.handshake.auth?.token;
    try {
      const resultado = await this.rastreio.autenticar(
        typeof token === 'string' ? token : '',
      );
      if (resultado.situacao !== 'valido') {
        cliente.emit(EVENTO_ACESSO_NEGADO, { situacao: resultado.situacao });
        cliente.disconnect(true);
        return;
      }
      await cliente.join(salaDoPedido(resultado.acesso.idPedido));
    } catch (erro) {
      this.logger.error('Falha ao autenticar o recebedor', erro);
      cliente.disconnect(true);
    }
  }

  publicar(idPedido: number, evento: string, dados: unknown): void {
    this.servidor?.to(salaDoPedido(idPedido)).emit(evento, dados);
  }

  encerrarSala(idPedido: number): void {
    this.servidor?.in(salaDoPedido(idPedido)).disconnectSockets(true);
  }
}
