import { IoAdapter } from '@nestjs/platform-socket.io';
import type { ServerOptions } from 'socket.io';

// Mesma origem do CORS HTTP (main.ts). Lido em runtime, depois do .env.
export class AdaptadorSocketIo extends IoAdapter {
  createIOServer(porta: number, opcoes?: ServerOptions): unknown {
    return super.createIOServer(porta, {
      ...opcoes,
      cors: {
        origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
        credentials: true,
      },
    });
  }
}
