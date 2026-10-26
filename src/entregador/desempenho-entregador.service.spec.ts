import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RepositorioDesempenhoEntregador } from './desempenho-entregador.repository';
import { ServicoDesempenhoEntregador } from './desempenho-entregador.service';

describe('ServicoDesempenhoEntregador', () => {
  const agregarDesempenho = jest.fn();
  const servicoDesempenho = new ServicoDesempenhoEntregador({
    agregarDesempenho,
  } as unknown as RepositorioDesempenhoEntregador);
  const filtroPeriodo = {
    de: '2026-10-01T00:00:00-03:00',
    ate: '2026-11-01T00:00:00-03:00',
  };
  const cpfEntregador = '52998224725';

  beforeEach(() => jest.resetAllMocks());

  it('normaliza o periodo em UTC e preserva indicadores nulos e zeros', async () => {
    const indicadoresDesempenho = {
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
    agregarDesempenho.mockResolvedValue(indicadoresDesempenho);
    await expect(
      servicoDesempenho.consultarDesempenho(10, cpfEntregador, filtroPeriodo),
    ).resolves.toEqual({
      cpf_entregador: cpfEntregador,
      periodo: {
        de: '2026-10-01T03:00:00.000Z',
        ate: '2026-11-01T03:00:00.000Z',
      },
      ...indicadoresDesempenho,
    });
    expect(agregarDesempenho).toHaveBeenCalledWith(
      10,
      cpfEntregador,
      new Date(filtroPeriodo.de),
      new Date(filtroPeriodo.ate),
    );
  });

  it('retorna 404 sem revelar se o entregador existe ou esta em outra empresa', async () => {
    agregarDesempenho.mockResolvedValue(null);
    await expect(
      servicoDesempenho.consultarDesempenho(10, cpfEntregador, filtroPeriodo),
    ).rejects.toThrow(NotFoundException);
  });

  it.each([
    { de: filtroPeriodo.ate, ate: filtroPeriodo.de },
    { de: filtroPeriodo.de, ate: filtroPeriodo.de },
    { de: 'invalida', ate: filtroPeriodo.ate },
  ])(
    'recusa intervalos invalidos antes de consultar: %p',
    async (intervaloInvalido) => {
      await expect(
        servicoDesempenho.consultarDesempenho(
          10,
          cpfEntregador,
          intervaloInvalido,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(agregarDesempenho).not.toHaveBeenCalled();
    },
  );
});
