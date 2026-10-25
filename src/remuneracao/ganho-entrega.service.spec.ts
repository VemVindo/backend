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
const criar_pedido = (campos: Partial<Pedido> = {}) =>
  ({
    ...PARAMETROS_CONGELADOS,
    distancia: 4200,
    distancia_conhecida: true,
    ...campos,
  }) as Pedido;

function montar_servico() {
  const cliente_transacional = {
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
  const calculo_valor_entrega = new CalculoValorEntregaService();
  const servico_ganhos = new GanhoEntregaService(
    new RemuneracaoRepository({} as PrismaService),
    calculo_valor_entrega,
  );
  return { servico_ganhos, cliente_transacional, calculo_valor_entrega };
}

describe('GanhoEntregaService', () => {
  it('captura valores, vigencia e instante usando o cliente transacional e a empresa', async () => {
    const { servico_ganhos, cliente_transacional } = montar_servico();
    await expect(
      servico_ganhos.capturar_parametros(
        cliente_transacional as unknown as Prisma.TransactionClient,
        7,
        AGORA,
      ),
    ).resolves.toEqual(PARAMETROS_CONGELADOS);
    expect(
      cliente_transacional.metricasPagamento.findFirst,
    ).toHaveBeenCalledWith({
      where: { idEmpresa: 7, data: { lte: AGORA } },
      orderBy: { data: 'desc' },
    });
  });

  it('bloqueia atribuicao sem parametros, sem assumir zeros', async () => {
    const { servico_ganhos, cliente_transacional } = montar_servico();
    cliente_transacional.metricasPagamento.findFirst.mockResolvedValue(null);
    await expect(
      servico_ganhos.capturar_parametros(
        cliente_transacional as unknown as Prisma.TransactionClient,
        7,
        AGORA,
      ),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('valida parametros invalidos na captura', async () => {
    const { servico_ganhos, cliente_transacional } = montar_servico();
    cliente_transacional.metricasPagamento.findFirst.mockResolvedValue({
      idEmpresa: 7,
      taxa_fixa: -1,
      coeficiente: 150,
      data: VIGENCIA,
    });
    await expect(
      servico_ganhos.capturar_parametros(
        cliente_transacional as unknown as Prisma.TransactionClient,
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
      taxa_fixa_centavos,
      coeficiente_centavos_km,
      ganho_esperado_centavos,
    ) => {
      const { servico_ganhos, cliente_transacional } = montar_servico();
      expect(
        servico_ganhos.consolidar_ganho(
          criar_pedido({
            distancia,
            taxa_fixa_atribuicao_centavos: taxa_fixa_centavos,
            coeficiente_atribuicao_centavos_km: coeficiente_centavos_km,
          }),
        ),
      ).toBe(ganho_esperado_centavos);
      expect(
        cliente_transacional.metricasPagamento.findFirst,
      ).not.toHaveBeenCalled();
    },
  );

  it.each([null, false])(
    'bloqueia distancia desconhecida (%s), inclusive zero legado',
    (distancia_conhecida) => {
      const { servico_ganhos } = montar_servico();
      expect(() =>
        servico_ganhos.consolidar_ganho(
          criar_pedido({
            distancia: 0,
            distancia_conhecida: distancia_conhecida,
          }),
        ),
      ).toThrow(UnprocessableEntityException);
    },
  );

  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejeita distancia invalida %s',
    (distancia) => {
      expect(() =>
        montar_servico().servico_ganhos.consolidar_ganho(
          criar_pedido({ distancia }),
        ),
      ).toThrow(BadRequestException);
    },
  );

  it('rejeita overflow usando o calculador existente', () => {
    expect(() =>
      montar_servico().servico_ganhos.consolidar_ganho(
        criar_pedido({ taxa_fixa_atribuicao_centavos: 2147483647 }),
      ),
    ).toThrow(BadRequestException);
  });

  it.each(Object.keys(PARAMETROS_CONGELADOS))(
    'bloqueia snapshot incompleto sem %s',
    (campo) => {
      expect(() =>
        montar_servico().servico_ganhos.consolidar_ganho(
          criar_pedido({ [campo]: null }),
        ),
      ).toThrow(UnprocessableEntityException);
    },
  );

  it('o snapshot nao depende de alteracoes posteriores no registro de parametros', async () => {
    const { servico_ganhos, cliente_transacional } = montar_servico();
    const parametros_congelados = await servico_ganhos.capturar_parametros(
      cliente_transacional as unknown as Prisma.TransactionClient,
      7,
      AGORA,
    );
    cliente_transacional.metricasPagamento.findFirst.mockResolvedValue({
      idEmpresa: 7,
      taxa_fixa: 9999,
      coeficiente: 9999,
      data: AGORA,
    });
    expect(
      servico_ganhos.consolidar_ganho(criar_pedido(parametros_congelados)),
    ).toBe(1430);
    expect(
      cliente_transacional.metricasPagamento.findFirst,
    ).toHaveBeenCalledTimes(1);
  });
});
