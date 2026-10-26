import { PrismaService } from '../prisma/prisma.service';
import { RastreioRepository } from './rastreio.repository';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

function montar() {
  const prisma = {
    acessoRecebedor: {
      upsert: jest.fn().mockResolvedValue({ idPedido: 42 }),
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    },
    pedido: { findFirst: jest.fn().mockResolvedValue(null) },
  };
  return {
    repo: new RastreioRepository(prisma as unknown as PrismaService),
    prisma,
  };
}

describe('RastreioRepository', () => {
  it('cria o acesso do pedido e, num link novo, troca so o token', async () => {
    const { repo, prisma } = montar();

    await expect(
      repo.salvarAcesso(42, 'hash-do-token', '1234'),
    ).resolves.toEqual({ idPedido: 42 });
    expect(prisma.acessoRecebedor.upsert).toHaveBeenCalledWith({
      where: { idPedido: 42 },
      create: {
        idPedido: 42,
        token_hash: 'hash-do-token',
        codigo_recebedor: '1234',
      },
      update: { token_hash: 'hash-do-token' },
    });
  });

  it('procura o acesso pelo token trazendo so os dados publicos do pedido', async () => {
    const { repo, prisma } = montar();

    await expect(
      repo.procurarPorTokenHash('hash-do-token'),
    ).resolves.toBeNull();
    expect(prisma.acessoRecebedor.findUnique).toHaveBeenCalledWith({
      where: { token_hash: 'hash-do-token' },
      include: {
        pedido: {
          include: {
            empresa: {
              select: {
                nome_fantasia: true,
                exibir_mapa: true,
                telefone: true,
              },
            },
            entregador: { select: { nome: true } },
          },
        },
      },
    });
  });

  it('procura o acesso pelo pedido', async () => {
    const { repo, prisma } = montar();

    await repo.procurarAcessoDoPedido(42);

    expect(prisma.acessoRecebedor.findUnique).toHaveBeenCalledWith({
      where: { idPedido: 42 },
    });
  });

  it('registra quantas vezes o codigo foi digitado errado e quando', async () => {
    const { repo, prisma } = montar();
    const quando = new Date('2026-10-25T12:00:00Z');

    await expect(
      repo.registrarTentativaErrada(42, 3, quando),
    ).resolves.toBeUndefined();
    expect(prisma.acessoRecebedor.update).toHaveBeenCalledWith({
      where: { idPedido: 42 },
      data: { tentativas_codigo: 3, ultima_tentativa_codigo: quando },
    });
  });

  it('so encontra o pedido quando ele pertence a empresa', async () => {
    const { repo, prisma } = montar();

    await expect(repo.procurarPedidoDaEmpresa(42, 7)).resolves.toBeNull();
    expect(prisma.pedido.findFirst).toHaveBeenCalledWith({
      where: { id_pedido: 42, idEmpresa: 7 },
    });
  });
});
