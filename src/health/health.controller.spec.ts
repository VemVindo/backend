import { PrismaService } from '../prisma/prisma.service';
import { HealthController } from './health.controller';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

describe('HealthController', () => {
  it('responde que o banco esta no ar depois de um SELECT 1', async () => {
    const consultarBanco = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
    const controlador = new HealthController({
      $queryRaw: consultarBanco,
    } as unknown as PrismaService);

    await expect(controlador.verificarBanco()).resolves.toEqual({
      database: 'up',
    });
    const [trechosDaConsulta] = consultarBanco.mock.calls[0] as [string[]];
    expect(trechosDaConsulta.join('')).toBe('SELECT 1');
  });

  it('propaga a falha quando o banco nao responde', async () => {
    const controlador = new HealthController({
      $queryRaw: jest.fn().mockRejectedValue(new Error('conexao recusada')),
    } as unknown as PrismaService);

    await expect(controlador.verificarBanco()).rejects.toThrow(
      'conexao recusada',
    );
  });
});
