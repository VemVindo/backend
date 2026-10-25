import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RepositorioDesempenhoEntregador } from './desempenho-entregador.repository';

describe('RepositorioDesempenhoEntregador', () => {
  const buscarEntregadorVinculado = jest.fn();
  const executarConsultaDesempenho = jest.fn<
    Promise<unknown[]>,
    [Prisma.Sql]
  >();
  const clienteTransacional = {
    entregador: { findFirst: buscarEntregadorVinculado },
    $queryRaw: executarConsultaDesempenho,
  };
  const executarTransacao = jest.fn();
  const repositorioDesempenho = new RepositorioDesempenhoEntregador({
    $transaction: executarTransacao,
  } as unknown as PrismaService);
  const dataInicioPeriodo = new Date('2026-10-01T00:00:00Z');
  const dataFimPeriodo = new Date('2026-11-01T00:00:00Z');

  beforeEach(() => {
    jest.resetAllMocks();
    executarTransacao.mockImplementation(
      (
        consultarNaTransacao: (
          clienteConsulta: typeof clienteTransacional,
        ) => unknown,
      ) => consultarNaTransacao(clienteTransacional),
    );
  });

  it('nao consulta indicadores sem vinculo ativo', async () => {
    buscarEntregadorVinculado.mockResolvedValue(null);
    await expect(
      repositorioDesempenho.agregarDesempenho(
        1,
        '52998224725',
        dataInicioPeriodo,
        dataFimPeriodo,
      ),
    ).resolves.toBeNull();
    expect(executarConsultaDesempenho).not.toHaveBeenCalled();
  });

  it('parametriza empresa, CPF e periodo e normaliza bigint sem perder null ou decimais', async () => {
    buscarEntregadorVinculado.mockResolvedValue({ cpf: '52998224725' });
    executarConsultaDesempenho.mockResolvedValue([
      {
        total_entregas: 2n,
        tempo_medio_entrega_segundos: 1.5,
        entregas_com_tempo_valido: 1n,
        entregas_sem_tempo_valido: 1n,
        avaliacao_media: null,
        total_avaliacoes: 0n,
        distancia_total_metros: null,
        distancia_conhecida_metros: 0n,
        entregas_com_distancia_conhecida: 1n,
        entregas_com_distancia_desconhecida: 1n,
      },
    ]);
    const indicadoresDesempenho = await repositorioDesempenho.agregarDesempenho(
      9,
      '52998224725',
      dataInicioPeriodo,
      dataFimPeriodo,
    );
    expect(indicadoresDesempenho).toMatchObject({
      total_entregas: 2,
      tempo_medio_entrega_segundos: 1.5,
      avaliacao_media: null,
      distancia_total_metros: null,
      distancia_conhecida_metros: 0,
    });
    expect(() => JSON.stringify(indicadoresDesempenho)).not.toThrow();
    const consultaParametrizada = executarConsultaDesempenho.mock.calls[0][0];
    expect(consultaParametrizada.values).toEqual([
      9,
      '52998224725',
      dataInicioPeriodo,
      dataFimPeriodo,
    ]);
    expect(executarTransacao).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
  });

  it('recusa totais que perderiam precisao na conversao para JSON', async () => {
    buscarEntregadorVinculado.mockResolvedValue({ cpf: '52998224725' });
    executarConsultaDesempenho.mockResolvedValue([
      { total_entregas: BigInt(Number.MAX_SAFE_INTEGER) + 1n },
    ]);
    await expect(
      repositorioDesempenho.agregarDesempenho(
        1,
        '52998224725',
        dataInicioPeriodo,
        dataFimPeriodo,
      ),
    ).rejects.toThrow(RangeError);
  });
});
