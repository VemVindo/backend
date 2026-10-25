import {
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { MetricasPagamento, Pedido, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CalculoValorEntregaService } from './calculo-valor-entrega.service';
import { GanhoEntregaService } from './ganho-entrega.service';
import { RemuneracaoRepository } from './remuneracao.repository';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

const AGORA = new Date('2026-10-24T12:00:00Z');
const VIGENCIA = new Date('2026-10-01T00:00:00Z');
const PARAMETROS_CONGELADOS = {
  taxa_fixa_atribuicao_centavos: 800,
  coeficiente_atribuicao_centavos_km: 150,
  parametros_vigentes_desde: VIGENCIA,
  remuneracao_atribuida_em: AGORA,
};
const criarPedido = (campos: Partial<Pedido> = {}) =>
  ({
    ...PARAMETROS_CONGELADOS,
    distancia: 4200,
    distancia_conhecida: true,
    ...campos,
  }) as Pedido;

function montarServico() {
  const clienteTransacional = {
    metricasPagamento: {
      findFirst: jest
        .fn<
          Promise<MetricasPagamento | null>,
          [Prisma.MetricasPagamentoFindFirstArgs]
        >()
        .mockResolvedValue({
          idEmpresa: 7,
          taxa_fixa: 800,
          coeficiente: 150,
          data: VIGENCIA,
        }),
    },
  };
  const calculoValorEntrega = new CalculoValorEntregaService();
  const servicoGanhos = new GanhoEntregaService(
    new RemuneracaoRepository({} as PrismaService),
    calculoValorEntrega,
  );
  return { servicoGanhos, clienteTransacional, calculoValorEntrega };
}

describe('GanhoEntregaService', () => {
  it('captura valores, vigencia e instante usando o cliente transacional e a empresa', async () => {
    const { servicoGanhos, clienteTransacional } = montarServico();
    await expect(
      servicoGanhos.capturarParametros(
        clienteTransacional as unknown as Prisma.TransactionClient,
        7,
        AGORA,
      ),
    ).resolves.toEqual(PARAMETROS_CONGELADOS);
    expect(
      clienteTransacional.metricasPagamento.findFirst,
    ).toHaveBeenCalledWith({
      where: { idEmpresa: 7, data: { lte: AGORA } },
      orderBy: { data: 'desc' },
    });
  });

  it('bloqueia atribuicao sem parametros, sem assumir zeros', async () => {
    const { servicoGanhos, clienteTransacional } = montarServico();
    clienteTransacional.metricasPagamento.findFirst.mockResolvedValue(null);
    await expect(
      servicoGanhos.capturarParametros(
        clienteTransacional as unknown as Prisma.TransactionClient,
        7,
        AGORA,
      ),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('valida parametros invalidos na captura', async () => {
    const { servicoGanhos, clienteTransacional } = montarServico();
    clienteTransacional.metricasPagamento.findFirst.mockResolvedValue({
      idEmpresa: 7,
      taxa_fixa: -1,
      coeficiente: 150,
      data: VIGENCIA,
    });
    await expect(
      servicoGanhos.capturarParametros(
        clienteTransacional as unknown as Prisma.TransactionClient,
        7,
        AGORA,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it.each([
    [4200, 800, 150, 1430],
    [0, 800, 150, 800],
    [4200, 0, 0, 0],
    [1, 0, 500, 1],
    [1234, 800, 150, 985],
  ])(
    'consolida %i metros, taxa %i e coeficiente %i em %i centavos',
    (
      distancia,
      taxaFixaCentavos,
      coeficienteCentavosKm,
      ganhoEsperadoCentavos,
    ) => {
      const { servicoGanhos, clienteTransacional } = montarServico();
      expect(
        servicoGanhos.consolidarGanho(
          criarPedido({
            distancia,
            taxa_fixa_atribuicao_centavos: taxaFixaCentavos,
            coeficiente_atribuicao_centavos_km: coeficienteCentavosKm,
          }),
        ),
      ).toBe(ganhoEsperadoCentavos);
      expect(
        clienteTransacional.metricasPagamento.findFirst,
      ).not.toHaveBeenCalled();
    },
  );

  it.each([null, false])(
    'bloqueia distancia desconhecida (%s), inclusive zero legado',
    (distanciaConhecida) => {
      const { servicoGanhos } = montarServico();
      expect(() =>
        servicoGanhos.consolidarGanho(
          criarPedido({
            distancia: 0,
            distancia_conhecida: distanciaConhecida,
          }),
        ),
      ).toThrow(UnprocessableEntityException);
    },
  );

  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejeita distancia invalida %s',
    (distancia) => {
      expect(() =>
        montarServico().servicoGanhos.consolidarGanho(
          criarPedido({ distancia }),
        ),
      ).toThrow(BadRequestException);
    },
  );

  it('rejeita overflow usando o calculador existente', () => {
    expect(() =>
      montarServico().servicoGanhos.consolidarGanho(
        criarPedido({ taxa_fixa_atribuicao_centavos: 2147483647 }),
      ),
    ).toThrow(BadRequestException);
  });

  it.each(Object.keys(PARAMETROS_CONGELADOS))(
    'bloqueia snapshot incompleto sem %s',
    (campo) => {
      expect(() =>
        montarServico().servicoGanhos.consolidarGanho(
          criarPedido({ [campo]: null }),
        ),
      ).toThrow(UnprocessableEntityException);
    },
  );

  it('o snapshot nao depende de alteracoes posteriores no registro de parametros', async () => {
    const { servicoGanhos, clienteTransacional } = montarServico();
    const parametrosCongelados = await servicoGanhos.capturarParametros(
      clienteTransacional as unknown as Prisma.TransactionClient,
      7,
      AGORA,
    );
    clienteTransacional.metricasPagamento.findFirst.mockResolvedValue({
      idEmpresa: 7,
      taxa_fixa: 9999,
      coeficiente: 9999,
      data: AGORA,
    });
    expect(
      servicoGanhos.consolidarGanho(criarPedido(parametrosCongelados)),
    ).toBe(1430);
    expect(
      clienteTransacional.metricasPagamento.findFirst,
    ).toHaveBeenCalledTimes(1);
  });
});
