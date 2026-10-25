import { PrismaService } from '../prisma/prisma.service';
import { CredencialRepository } from './credencial.repository';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

const AGORA = new Date('2026-10-25T12:00:00Z');

function tabelaDeCredenciais() {
  return {
    findFirst: jest.fn().mockResolvedValue(null),
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id_credencial: 2 }),
    update: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  };
}

function montar() {
  const transacao = { credencialIntegracao: tabelaDeCredenciais() };
  const prisma = {
    credencialIntegracao: tabelaDeCredenciais(),
    $transaction: jest.fn(
      (operacao: (cliente: typeof transacao) => Promise<unknown>) =>
        operacao(transacao),
    ),
  };
  return {
    repo: new CredencialRepository(prisma as unknown as PrismaService),
    prisma,
    transacao,
  };
}

describe('CredencialRepository', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(AGORA));
  afterEach(() => jest.useRealTimers());

  it('procura a credencial nao revogada da empresa', async () => {
    const { repo, prisma } = montar();

    await expect(repo.procurarAtiva(7)).resolves.toBeNull();
    expect(prisma.credencialIntegracao.findFirst).toHaveBeenCalledWith({
      where: { idEmpresa: 7, data_revogacao: null },
    });
  });

  it('procura a credencial pelo prefixo da chave', async () => {
    const { repo, prisma } = montar();

    await repo.procurarPorPrefixo('vv_abc123');

    expect(prisma.credencialIntegracao.findUnique).toHaveBeenCalledWith({
      where: { prefixo: 'vv_abc123' },
    });
  });

  it('guarda so o hash da chave nova', async () => {
    const { repo, prisma } = montar();

    await expect(repo.criar(7, 'vv_abc123', 'hash-da-chave')).resolves.toEqual({
      id_credencial: 2,
    });
    expect(prisma.credencialIntegracao.create).toHaveBeenCalledWith({
      data: { idEmpresa: 7, prefixo: 'vv_abc123', hash: 'hash-da-chave' },
    });
  });

  it('substitui a chave revogando a antiga na mesma transacao', async () => {
    const { repo, prisma, transacao } = montar();

    await expect(repo.substituir(7, 'vv_novo', 'hash-novo')).resolves.toEqual({
      id_credencial: 2,
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(transacao.credencialIntegracao.updateMany).toHaveBeenCalledWith({
      where: { idEmpresa: 7, data_revogacao: null },
      data: { data_revogacao: AGORA },
    });
    expect(transacao.credencialIntegracao.create).toHaveBeenCalledWith({
      data: { idEmpresa: 7, prefixo: 'vv_novo', hash: 'hash-novo' },
    });
    expect(prisma.credencialIntegracao.create).not.toHaveBeenCalled();
  });

  it('revoga a credencial ativa e informa quantas revogou', async () => {
    const { repo, prisma } = montar();

    await expect(repo.revogarAtiva(7)).resolves.toBe(1);
    expect(prisma.credencialIntegracao.updateMany).toHaveBeenCalledWith({
      where: { idEmpresa: 7, data_revogacao: null },
      data: { data_revogacao: AGORA },
    });
  });

  it('registra o horario do ultimo uso', async () => {
    const { repo, prisma } = montar();

    await expect(repo.registrarUso(2)).resolves.toBeUndefined();
    expect(prisma.credencialIntegracao.update).toHaveBeenCalledWith({
      where: { id_credencial: 2 },
      data: { ultimo_uso: AGORA },
    });
  });
});
