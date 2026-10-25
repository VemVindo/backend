import { Logger } from '@nestjs/common';
import type { Socket } from 'socket.io';
import { ValidadorDeLink } from './validador-de-link';
import {
  EVENTO_ACESSO_NEGADO,
  RastreioGateway,
  salaDoPedido,
} from './rastreio.gateway';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

function cliente(token?: unknown) {
  return {
    handshake: { auth: token === undefined ? {} : { token } },
    emit: jest.fn(),
    join: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn(),
  };
}

function montar(autenticar: jest.Mock) {
  const gateway = new RastreioGateway({
    autenticar,
  } as unknown as ValidadorDeLink);
  const sala = { emit: jest.fn(), disconnectSockets: jest.fn() };
  const servidor = { to: jest.fn(() => sala), in: jest.fn(() => sala) };
  Object.assign(gateway, { servidor });
  return { gateway, servidor, sala };
}

describe('RastreioGateway', () => {
  it('poe o recebedor com link valido na sala do pedido', async () => {
    const autenticar = jest.fn().mockResolvedValue({
      situacao: 'valido',
      acesso: { idPedido: 42 },
    });
    const { gateway } = montar(autenticar);
    const socket = cliente('token-valido');

    await gateway.handleConnection(socket);

    expect(autenticar).toHaveBeenCalledWith('token-valido');
    expect(socket.join).toHaveBeenCalledWith('pedido:42');
    expect(socket.disconnect).not.toHaveBeenCalled();
  });

  it.each(['invalido', 'encerrado'])(
    'desconecta o link %s e diz o motivo',
    async (situacao) => {
      const { gateway } = montar(jest.fn().mockResolvedValue({ situacao }));
      const socket = cliente('token');

      await gateway.handleConnection(socket);

      expect(socket.emit).toHaveBeenCalledWith(EVENTO_ACESSO_NEGADO, {
        situacao,
      });
      expect(socket.disconnect).toHaveBeenCalledWith(true);
      expect(socket.join).not.toHaveBeenCalled();
    },
  );

  it('trata token ausente ou que nao e texto como vazio', async () => {
    const autenticar = jest.fn().mockResolvedValue({ situacao: 'invalido' });
    const { gateway } = montar(autenticar);

    await gateway.handleConnection(cliente());
    await gateway.handleConnection(cliente(123));

    expect(autenticar).toHaveBeenNthCalledWith(1, '');
    expect(autenticar).toHaveBeenNthCalledWith(2, '');
  });

  it('desconecta se a autenticacao falhar', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { gateway } = montar(jest.fn().mockRejectedValue(new Error('banco')));
    const socket = cliente('token');

    await gateway.handleConnection(socket);

    expect(socket.disconnect).toHaveBeenCalledWith(true);
  });

  it('publica e fecha so a sala do pedido', () => {
    const { gateway, servidor, sala } = montar(jest.fn());

    gateway.publicar(42, 'localizacao', { distanciaRestanteM: 10 });
    gateway.encerrarSala(42);

    expect(servidor.to).toHaveBeenCalledWith(salaDoPedido(42));
    expect(sala.emit).toHaveBeenCalledWith('localizacao', {
      distanciaRestanteM: 10,
    });
    expect(servidor.in).toHaveBeenCalledWith('pedido:42');
    expect(sala.disconnectSockets).toHaveBeenCalledWith(true);
  });

  it('revoga o link: avisa link invalido e fecha a sala', () => {
    const { gateway, servidor, sala } = montar(jest.fn());

    gateway.revogarLink(42);

    expect(servidor.to).toHaveBeenCalledWith('pedido:42');
    expect(sala.emit).toHaveBeenCalledWith(EVENTO_ACESSO_NEGADO, {
      situacao: 'invalido',
    });
    expect(sala.disconnectSockets).toHaveBeenCalledWith(true);
  });
});
