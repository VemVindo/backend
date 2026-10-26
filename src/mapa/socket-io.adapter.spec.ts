import { IoAdapter } from '@nestjs/platform-socket.io';
import type { ServerOptions } from 'socket.io';
import { AdaptadorSocketIo } from './socket-io.adapter';

const OPCOES_DO_GATEWAY = { path: '/socket.io' } as ServerOptions;

const ambienteOriginal = { ...process.env };

describe('AdaptadorSocketIo', () => {
  let criarServidorDoNest: jest.SpyInstance;

  beforeEach(() => {
    criarServidorDoNest = jest
      .spyOn(IoAdapter.prototype, 'createIOServer')
      .mockReturnValue('servidor');
  });

  afterEach(() => {
    process.env = { ...ambienteOriginal };
    jest.restoreAllMocks();
  });

  it('libera o frontend local com credenciais quando CORS_ORIGIN nao existe', () => {
    delete process.env.CORS_ORIGIN;

    const servidor = new AdaptadorSocketIo().createIOServer(
      3001,
      OPCOES_DO_GATEWAY,
    );

    expect(servidor).toBe('servidor');
    expect(criarServidorDoNest).toHaveBeenCalledWith(3001, {
      path: '/socket.io',
      cors: { origin: 'http://localhost:3000', credentials: true },
    });
  });

  it('usa a origem configurada no ambiente', () => {
    process.env.CORS_ORIGIN = 'https://vemvindo.exemplo.com';

    new AdaptadorSocketIo().createIOServer(3001);

    expect(criarServidorDoNest).toHaveBeenCalledWith(3001, {
      cors: { origin: 'https://vemvindo.exemplo.com', credentials: true },
    });
  });
});
