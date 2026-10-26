import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type {
  MetricasPagamento,
  Pedido,
  PedidoImportado,
} from '../../generated/prisma/client';
import { StatusPedido } from '../../generated/prisma/enums';
import {
  RotaAteORecebedor,
  RotaDeCarroService,
} from '../../mapa/rota-de-carro.service';
import { CalculoValorEntregaService } from '../../remuneracao/calculo-valor-entrega.service';
import {
  ImportacaoRepository,
  PendenciaJaConvertida,
} from './importacao.repository';
import { ImportacaoService } from './importacao.service';

jest.mock('../../prisma/prisma.service', () => ({ PrismaService: class {} }));

const CANTINA = 1;
const PADARIA = 2;
const METRICAS = {
  idEmpresa: CANTINA,
  taxa_fixa: 800,
  coeficiente: 150,
} as MetricasPagamento;

type Repositorio = ImportacaoRepository;
const simuladoDe = <K extends keyof Repositorio>() =>
  jest.fn<ReturnType<Repositorio[K]>, Parameters<Repositorio[K]>>();
const pedido = (idPedido: number) => ({ id_pedido: idPedido }) as Pedido;
const importado = (dados: Partial<PedidoImportado>) => dados as PedidoImportado;

const camposDoPedido = {
  nomeRecebedor: 'Carla Menezes',
  telefoneRecebedor: '61920000001',
  cep: '70000000',
  logradouro: 'SQN 210 Bloco K',
  numero: 304,
  bairro: 'Asa Norte',
  cidade: 'Brasilia',
  uf: 'DF',
  descricao: 'Duas marmitas',
};
const completo = { idExterno: 'PED-1', ...camposDoPedido };
const ROTA_DE_4_KM: RotaAteORecebedor = {
  distanciaM: 4200,
  destino: { lat: -15.75, lng: -47.88 },
};

function montar() {
  const importacoes = {
    procurarPorIdExterno:
      simuladoDe<'procurarPorIdExterno'>().mockResolvedValue(null),
    procurarMetricasVigentes:
      simuladoDe<'procurarMetricasVigentes'>().mockResolvedValue(METRICAS),
    criarPendencia: simuladoDe<'criarPendencia'>().mockResolvedValue(
      importado({ id_importacao: 7 }),
    ),
    criarPedidoImportado:
      simuladoDe<'criarPedidoImportado'>().mockResolvedValue(pedido(42)),
    listarPendencias: simuladoDe<'listarPendencias'>().mockResolvedValue([]),
    procurarPendencia:
      simuladoDe<'procurarPendencia'>().mockResolvedValue(null),
    atualizarPendencia: simuladoDe<'atualizarPendencia'>().mockResolvedValue(
      importado({}),
    ),
    converterPendencia: simuladoDe<'converterPendencia'>().mockResolvedValue(
      pedido(43),
    ),
  };
  const rotaDeCarro = {
    calcular: jest
      .fn<
        Promise<RotaAteORecebedor | null>,
        Parameters<RotaDeCarroService['calcular']>
      >()
      .mockResolvedValue(null),
  };
  const servico = new ImportacaoService(
    importacoes as unknown as ImportacaoRepository,
    new CalculoValorEntregaService(),
    rotaDeCarro as unknown as RotaDeCarroService,
  );
  return { servico, importacoes, rotaDeCarro };
}

describe('ImportacaoService.importar', () => {
  it('cria o pedido pendente com a taxa fixa da empresa como valor', async () => {
    const { servico, importacoes } = montar();

    const { resultados, resumo } = await servico.importar(CANTINA, [completo]);

    expect(resultados).toEqual([
      { idExterno: 'PED-1', situacao: 'importado', idPedido: 42 },
    ]);
    expect(resumo).toEqual(
      expect.objectContaining({ recebidos: 1, importados: 1 }),
    );
    const [idEmpresa, idExterno, , pedido] =
      importacoes.criarPedidoImportado.mock.calls[0];
    expect(idEmpresa).toBe(CANTINA);
    expect(idExterno).toBe('PED-1');
    expect(pedido).toEqual(
      expect.objectContaining({
        status: StatusPedido.PENDENTE,
        distancia: 0,
        distancia_conhecida: false,
        valor_entrega: 800,
        complemento: null,
      }),
    );
  });

  it('cobra pelo km da rota de carro ate o recebedor e guarda o destino', async () => {
    const { servico, importacoes, rotaDeCarro } = montar();
    rotaDeCarro.calcular.mockResolvedValue(ROTA_DE_4_KM);

    await servico.importar(CANTINA, [completo]);

    expect(rotaDeCarro.calcular).toHaveBeenCalledWith(
      CANTINA,
      expect.objectContaining({
        logradouro: 'SQN 210 Bloco K',
        numero: 304,
        cep: '70000000',
      }),
    );
    expect(importacoes.criarPedidoImportado.mock.calls[0][3]).toEqual(
      expect.objectContaining({
        distancia: 4200,
        distancia_conhecida: true,
        valor_entrega: 1430,
        destino_lat: -15.75,
        destino_lng: -47.88,
      }),
    );
  });

  it('preserva previsao, mas marca distancia como desconhecida quando nao ha rota', async () => {
    const { servico, importacoes } = montar();

    const { resultados } = await servico.importar(CANTINA, [completo]);

    expect(resultados[0].situacao).toBe('importado');
    expect(importacoes.criarPedidoImportado.mock.calls[0][3]).toEqual(
      expect.objectContaining({
        distancia: 0,
        distancia_conhecida: false,
        valor_entrega: 800,
        destino_lat: null,
        destino_lng: null,
      }),
    );
  });

  it('nao gasta chamada ao Google com pedido incompleto', async () => {
    const { servico, rotaDeCarro } = montar();

    await servico.importar(CANTINA, [{ ...completo, cep: undefined }]);

    expect(rotaDeCarro.calcular).not.toHaveBeenCalled();
  });

  it('distingue rota conhecida com zero metros do fallback sem rota', async () => {
    const { servico, importacoes, rotaDeCarro } = montar();
    rotaDeCarro.calcular.mockResolvedValue({ ...ROTA_DE_4_KM, distanciaM: 0 });
    await servico.importar(CANTINA, [completo]);
    expect(importacoes.criarPedidoImportado.mock.calls[0][3]).toMatchObject({
      distancia: 0,
      distancia_conhecida: true,
    });
  });

  it('usa sempre a empresa da credencial, mesmo com idEmpresa no corpo', async () => {
    const { servico, importacoes } = montar();

    await servico.importar(CANTINA, [{ ...completo, idEmpresa: PADARIA }]);

    const [idEmpresa, , dados, pedido] =
      importacoes.criarPedidoImportado.mock.calls[0];
    expect(idEmpresa).toBe(CANTINA);
    expect(dados).not.toHaveProperty('idEmpresa');
    expect(pedido).not.toHaveProperty('idEmpresa');
  });

  it('junta as observacoes na descricao', async () => {
    const { servico, importacoes } = montar();

    await servico.importar(CANTINA, [
      { ...completo, observacoes: 'Interfone 304' },
    ]);

    const pedido = importacoes.criarPedidoImportado.mock.calls[0][3];
    expect(pedido.descricao).toBe('Duas marmitas\nObservacoes: Interfone 304');
  });

  it('guarda pedido com dado faltando como pendencia de completude', async () => {
    const { servico, importacoes } = montar();

    const { resultados } = await servico.importar(CANTINA, [
      { ...completo, telefoneRecebedor: '123', cep: undefined },
    ]);

    expect(resultados[0]).toEqual({
      idExterno: 'PED-1',
      situacao: 'incompleto',
      idPendencia: 7,
      camposFaltantes: ['telefoneRecebedor', 'cep'],
    });
    expect(importacoes.criarPedidoImportado).not.toHaveBeenCalled();
  });

  it('importa com valor zero quando a empresa nao tem parametros de remuneracao', async () => {
    const { servico, importacoes } = montar();
    importacoes.procurarMetricasVigentes.mockResolvedValue(null);

    const { resultados } = await servico.importar(CANTINA, [completo]);

    expect(resultados[0].situacao).toBe('importado');
    const pedido = importacoes.criarPedidoImportado.mock.calls[0][3];
    expect(pedido.valor_entrega).toBe(0);
  });

  it('nao exige campos que a US nao pede', async () => {
    const { servico, importacoes } = montar();

    const { resultados } = await servico.importar(CANTINA, [completo]);

    expect(resultados[0].situacao).toBe('importado');
    expect(importacoes.criarPendencia).not.toHaveBeenCalled();
  });

  it('nao importa duas vezes o mesmo idExterno', async () => {
    const { servico, importacoes } = montar();
    importacoes.procurarPorIdExterno.mockResolvedValue(
      importado({ id_importacao: 1 }),
    );

    const { resultados } = await servico.importar(CANTINA, [completo]);

    expect(resultados[0]).toEqual({
      idExterno: 'PED-1',
      situacao: 'duplicado',
    });
    expect(importacoes.criarPedidoImportado).not.toHaveBeenCalled();
  });

  it('trata a corrida no indice unico como duplicado', async () => {
    const { servico, importacoes } = montar();
    importacoes.criarPedidoImportado.mockRejectedValue({ code: 'P2002' });

    const { resultados } = await servico.importar(CANTINA, [completo]);

    expect(resultados[0].situacao).toBe('duplicado');
  });

  it('propaga erro do banco que nao e de pedido duplicado', async () => {
    const { servico, importacoes } = montar();
    const falha = new Error('banco fora do ar');
    importacoes.criarPedidoImportado.mockRejectedValue(falha);

    await expect(servico.importar(CANTINA, [completo])).rejects.toBe(falha);
  });

  it('recusa item sem idExterno valido ou que nao e objeto', async () => {
    const { servico, importacoes } = montar();

    const { resultados, resumo } = await servico.importar(CANTINA, [
      { ...completo, idExterno: 'tem espaco' },
      'pedido em texto',
    ]);

    expect(resultados.map((r) => r.situacao)).toEqual(['invalido', 'invalido']);
    expect(resumo.invalidos).toBe(2);
    expect(importacoes.procurarPorIdExterno).not.toHaveBeenCalled();
  });

  it('processa cada item do lote de forma independente', async () => {
    const { servico } = montar();

    const { resumo } = await servico.importar(CANTINA, [
      completo,
      { ...completo, idExterno: 'PED-2', cep: 'abc' },
      { idExterno: 'PED-3' },
    ]);

    expect(resumo).toEqual({
      recebidos: 3,
      importados: 1,
      incompletos: 2,
      duplicados: 0,
      invalidos: 0,
    });
  });
});

describe('ImportacaoService.completar', () => {
  const pendencia = importado({
    id_importacao: 7,
    idEmpresa: CANTINA,
    dados: { ...camposDoPedido, telefoneRecebedor: '123', cep: 'abc' },
  });

  it('cria o pedido quando o complemento preenche o que faltava', async () => {
    const { servico, importacoes } = montar();
    importacoes.procurarPendencia.mockResolvedValue(pendencia);

    const resultado = await servico.completar(CANTINA, 7, {
      telefoneRecebedor: '61920000009',
      cep: '70000001',
    });

    expect(resultado).toEqual({ idPedido: 43 });
    const [idPendencia, idEmpresa, , pedido] =
      importacoes.converterPendencia.mock.calls[0];
    expect(idPendencia).toBe(7);
    expect(idEmpresa).toBe(CANTINA);
    expect(pedido).toEqual(
      expect.objectContaining({
        telefone_recebedor: '61920000009',
        cep: '70000001',
      }),
    );
  });

  it('calcula a rota com o endereco completado', async () => {
    const { servico, importacoes, rotaDeCarro } = montar();
    importacoes.procurarPendencia.mockResolvedValue(pendencia);
    rotaDeCarro.calcular.mockResolvedValue(ROTA_DE_4_KM);

    await servico.completar(CANTINA, 7, {
      telefoneRecebedor: '61920000009',
      cep: '70000001',
    });

    expect(rotaDeCarro.calcular).toHaveBeenCalledWith(
      CANTINA,
      expect.objectContaining({ cep: '70000001' }),
    );
    expect(importacoes.converterPendencia.mock.calls[0][3]).toEqual(
      expect.objectContaining({ distancia: 4200, valor_entrega: 1430 }),
    );
  });

  it('salva o progresso e responde 422 quando ainda falta dado', async () => {
    const { servico, importacoes } = montar();
    importacoes.procurarPendencia.mockResolvedValue(pendencia);

    await expect(
      servico.completar(CANTINA, 7, { cep: '70000001' }),
    ).rejects.toThrow(UnprocessableEntityException);
    expect(importacoes.atualizarPendencia).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ cep: '70000001' }),
      ['telefoneRecebedor'],
    );
    expect(importacoes.converterPendencia).not.toHaveBeenCalled();
  });

  it('procura a pendencia so dentro da empresa logada', async () => {
    const { servico, importacoes } = montar();

    await expect(servico.completar(PADARIA, 7, {})).rejects.toThrow(
      NotFoundException,
    );
    expect(importacoes.procurarPendencia).toHaveBeenCalledWith(7, PADARIA);
  });

  it('propaga erro do banco ao converter a pendencia', async () => {
    const { servico, importacoes } = montar();
    const falha = new Error('banco fora do ar');
    importacoes.procurarPendencia.mockResolvedValue(pendencia);
    importacoes.converterPendencia.mockRejectedValue(falha);

    await expect(
      servico.completar(CANTINA, 7, {
        telefoneRecebedor: '61920000009',
        cep: '70000001',
      }),
    ).rejects.toBe(falha);
  });

  it('responde 404 se outra requisicao converteu a pendencia antes', async () => {
    const { servico, importacoes } = montar();
    importacoes.procurarPendencia.mockResolvedValue(pendencia);
    importacoes.converterPendencia.mockRejectedValue(
      new PendenciaJaConvertida(),
    );

    await expect(
      servico.completar(CANTINA, 7, {
        telefoneRecebedor: '61920000009',
        cep: '70000001',
      }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('ImportacaoService.listarPendencias', () => {
  it('lista as pendencias da empresa com os campos faltantes', async () => {
    const { servico, importacoes } = montar();
    importacoes.listarPendencias.mockResolvedValue([
      importado({
        id_importacao: 7,
        id_externo: 'PED-1',
        data_recebimento: new Date('2026-10-14T12:00:00Z'),
        dados: { cep: '70000000' },
        campos_faltantes: ['cep'],
      }),
    ]);

    const pendencias = await servico.listarPendencias(CANTINA);

    expect(importacoes.listarPendencias).toHaveBeenCalledWith(CANTINA);
    expect(pendencias).toEqual([
      expect.objectContaining({
        id: 7,
        idExterno: 'PED-1',
        camposFaltantes: ['cep'],
      }),
    ]);
  });
});
