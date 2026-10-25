import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RepositorioDesempenhoEntregador } from './desempenho-entregador.repository';
import { ServicoDesempenhoEntregador } from './desempenho-entregador.service';

describe('ServicoDesempenhoEntregador', () => {
  const agregar_desempenho = jest.fn();
  const servico_desempenho = new ServicoDesempenhoEntregador({
    agregar_desempenho,
  } as unknown as RepositorioDesempenhoEntregador);
  const filtro_periodo = {
    de: '2026-10-01T00:00:00-03:00',
    ate: '2026-11-01T00:00:00-03:00',
  };
  const cpf_entregador = '52998224725';

  beforeEach(() => jest.resetAllMocks());

  it('normaliza o periodo em UTC e preserva indicadores nulos e zeros', async () => {
    const indicadores_desempenho = {
      total_entregas: 0,
      tempo_medio_entrega_segundos: null,
      entregas_com_tempo_valido: 0,
      entregas_sem_tempo_valido: 0,
      avaliacao_media: null,
      total_avaliacoes: 0,
      distancia_total_metros: 0,
      distancia_conhecida_metros: 0,
      entregas_com_distancia_conhecida: 0,
      entregas_com_distancia_desconhecida: 0,
    };
    agregar_desempenho.mockResolvedValue(indicadores_desempenho);
    await expect(
      servico_desempenho.consultar_desempenho(
        10,
        cpf_entregador,
        filtro_periodo,
      ),
    ).resolves.toEqual({
      cpf_entregador,
      periodo: {
        de: '2026-10-01T03:00:00.000Z',
        ate: '2026-11-01T03:00:00.000Z',
      },
      ...indicadores_desempenho,
    });
    expect(agregar_desempenho).toHaveBeenCalledWith(
      10,
      cpf_entregador,
      new Date(filtro_periodo.de),
      new Date(filtro_periodo.ate),
    );
  });

  it('retorna 404 sem revelar se o entregador existe ou esta em outra empresa', async () => {
    agregar_desempenho.mockResolvedValue(null);
    await expect(
      servico_desempenho.consultar_desempenho(
        10,
        cpf_entregador,
        filtro_periodo,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it.each([
    { de: filtro_periodo.ate, ate: filtro_periodo.de },
    { de: filtro_periodo.de, ate: filtro_periodo.de },
    { de: 'invalida', ate: filtro_periodo.ate },
  ])(
    'recusa intervalos invalidos antes de consultar: %p',
    async (intervalo_invalido) => {
      await expect(
        servico_desempenho.consultar_desempenho(
          10,
          cpf_entregador,
          intervalo_invalido,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(agregar_desempenho).not.toHaveBeenCalled();
    },
  );
});
