import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RepositorioDesempenhoEntregador } from './desempenho-entregador.repository';

describe('RepositorioDesempenhoEntregador', () => {
  const buscar_entregador_vinculado = jest.fn();
  const executar_consulta_desempenho = jest.fn<
    Promise<unknown[]>,
    [Prisma.Sql]
  >();
  const cliente_transacional = {
    entregador: { findFirst: buscar_entregador_vinculado },
    $queryRaw: executar_consulta_desempenho,
  };
  const executar_transacao = jest.fn();
  const repositorio_desempenho = new RepositorioDesempenhoEntregador({
    $transaction: executar_transacao,
  } as unknown as PrismaService);
  const data_inicio_periodo = new Date('2026-10-01T00:00:00Z');
  const data_fim_periodo = new Date('2026-11-01T00:00:00Z');

  beforeEach(() => {
    jest.resetAllMocks();
    executar_transacao.mockImplementation(
      (
        consultar_na_transacao: (
          cliente_consulta: typeof cliente_transacional,
        ) => unknown,
      ) => consultar_na_transacao(cliente_transacional),
    );
  });

  it('nao consulta indicadores sem vinculo ativo', async () => {
    buscar_entregador_vinculado.mockResolvedValue(null);
    await expect(
      repositorio_desempenho.agregar_desempenho(
        1,
        '52998224725',
        data_inicio_periodo,
        data_fim_periodo,
      ),
    ).resolves.toBeNull();
    expect(executar_consulta_desempenho).not.toHaveBeenCalled();
  });

  it('parametriza empresa, CPF e periodo e normaliza bigint sem perder null ou decimais', async () => {
    buscar_entregador_vinculado.mockResolvedValue({ cpf: '52998224725' });
    executar_consulta_desempenho.mockResolvedValue([
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
    const indicadores_desempenho =
      await repositorio_desempenho.agregar_desempenho(
        9,
        '52998224725',
        data_inicio_periodo,
        data_fim_periodo,
      );
    expect(indicadores_desempenho).toMatchObject({
      total_entregas: 2,
      tempo_medio_entrega_segundos: 1.5,
      avaliacao_media: null,
      distancia_total_metros: null,
      distancia_conhecida_metros: 0,
    });
    expect(() => JSON.stringify(indicadores_desempenho)).not.toThrow();
    const consulta_parametrizada =
      executar_consulta_desempenho.mock.calls[0][0];
    expect(consulta_parametrizada.values).toEqual([
      9,
      '52998224725',
      data_inicio_periodo,
      data_fim_periodo,
    ]);
    expect(executar_transacao).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
  });

  it('recusa totais que perderiam precisao na conversao para JSON', async () => {
    buscar_entregador_vinculado.mockResolvedValue({ cpf: '52998224725' });
    executar_consulta_desempenho.mockResolvedValue([
      { total_entregas: BigInt(Number.MAX_SAFE_INTEGER) + 1n },
    ]);
    await expect(
      repositorio_desempenho.agregar_desempenho(
        1,
        '52998224725',
        data_inicio_periodo,
        data_fim_periodo,
      ),
    ).rejects.toThrow(RangeError);
  });
});
