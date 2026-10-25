import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaService } from './prisma.service';

jest.mock('@prisma/adapter-pg', () => ({ PrismaPg: jest.fn() }));
jest.mock('../generated/prisma/client', () => ({
  PrismaClient: class {
    constructor(readonly opcoes: unknown) {}
    $connect = jest.fn().mockResolvedValue(undefined);
    $disconnect = jest.fn().mockResolvedValue(undefined);
  },
}));

const ambienteOriginal = { ...process.env };

describe('PrismaService', () => {
  afterEach(() => {
    process.env = { ...ambienteOriginal };
    jest.clearAllMocks();
  });

  it('usa a URL do banco e o pool padrao de 5 conexoes', () => {
    process.env.DATABASE_URL = 'postgresql://banco-de-teste';
    delete process.env.DB_POOL_MAX;

    new PrismaService();

    expect(PrismaPg).toHaveBeenCalledWith({
      connectionString: 'postgresql://banco-de-teste',
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  });

  it('respeita o tamanho de pool configurado', () => {
    process.env.DB_POOL_MAX = '12';

    new PrismaService();

    expect(PrismaPg).toHaveBeenCalledWith(expect.objectContaining({ max: 12 }));
  });

  it('conecta ao iniciar o modulo e desconecta ao encerrar', async () => {
    const prisma = new PrismaService();
    const conectar = jest.spyOn(prisma, '$connect');
    const desconectar = jest.spyOn(prisma, '$disconnect');

    await prisma.onModuleInit();
    await prisma.onModuleDestroy();

    expect(conectar).toHaveBeenCalledTimes(1);
    expect(desconectar).toHaveBeenCalledTimes(1);
  });
});
