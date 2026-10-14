import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type {
  MetricasPagamento,
  Pedido,
  PedidoImportado,
} from '../../generated/prisma/client';
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
const mockDe = <K extends keyof Repositorio>() =>
  jest.fn<ReturnType<Repositorio[K]>, Parameters<Repositorio[K]>>();
const pedido = (id_pedido: number) => ({ id_pedido }) as Pedido;
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

function montar() {
  const importacoes = {
    procurarPorIdExterno:
      mockDe<'procurarPorIdExterno'>().mockResolvedValue(null),
    procurarMetricasVigentes:
      mockDe<'procurarMetricasVigentes'>().mockResolvedValue(METRICAS),
    criarPendencia: mockDe<'criarPendencia'>().mockResolvedValue(
      importado({ id_importacao: 7 }),
    ),
    criarPedidoImportado: mockDe<'criarPedidoImportado'>().mockResolvedValue(
      pedido(42),
    ),
    listarPendencias: mockDe<'listarPendencias'>().mockResolvedValue([]),
    procurarPendencia: mockDe<'procurarPendencia'>().mockResolvedValue(null),
    atualizarPendencia: mockDe<'atualizarPendencia'>().mockResolvedValue(
      importado({}),
    ),
    converterPendencia: mockDe<'converterPendencia'>().mockResolvedValue(
      pedido(43),
    ),
  };
  const service = new ImportacaoService(
    importacoes as unknown as ImportacaoRepository,
    new CalculoValorEntregaService(),
  );
  return { service, importacoes };
}

describe('ImportacaoService.importar', () => {
  it('cria o pedido pendente com a taxa fixa da empresa como valor', async () => {
    const { service, importacoes } = montar();

    const { resultados, resumo } = await service.importar(CANTINA, [completo]);

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
        status: 'Pendente',
        distancia: 0,
        valor_entrega: 800,
        complemento: null,
      }),
    );
  });

  it('usa sempre a empresa da credencial, mesmo com idEmpresa no corpo', async () => {
    const { service, importacoes } = montar();

    await service.importar(CANTINA, [{ ...completo, idEmpresa: PADARIA }]);

    const [idEmpresa, , dados, pedido] =
      importacoes.criarPedidoImportado.mock.calls[0];
    expect(idEmpresa).toBe(CANTINA);
    expect(dados).not.toHaveProperty('idEmpresa');
    expect(pedido).not.toHaveProperty('idEmpresa');
  });

  it('junta as observacoes na descricao', async () => {
    const { service, importacoes } = montar();

    await service.importar(CANTINA, [
      { ...completo, observacoes: 'Interfone 304' },
    ]);

    const pedido = importacoes.criarPedidoImportado.mock.calls[0][3];
    expect(pedido.descricao).toBe('Duas marmitas\nObservacoes: Interfone 304');
  });

  it('guarda pedido com dado faltando como pendencia de completude', async () => {
    const { service, importacoes } = montar();

    const { resultados } = await service.importar(CANTINA, [
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
    const { service, importacoes } = montar();
    importacoes.procurarMetricasVigentes.mockResolvedValue(null);

    const { resultados } = await service.importar(CANTINA, [completo]);

    expect(resultados[0].situacao).toBe('importado');
    const pedido = importacoes.criarPedidoImportado.mock.calls[0][3];
    expect(pedido.valor_entrega).toBe(0);
  });

  it('nao exige campos que a US nao pede', async () => {
    const { service, importacoes } = montar();

    const { resultados } = await service.importar(CANTINA, [completo]);

    expect(resultados[0].situacao).toBe('importado');
    expect(importacoes.criarPendencia).not.toHaveBeenCalled();
  });

  it('nao importa duas vezes o mesmo idExterno', async () => {
    const { service, importacoes } = montar();
    importacoes.procurarPorIdExterno.mockResolvedValue(
      importado({ id_importacao: 1 }),
    );

    const { resultados } = await service.importar(CANTINA, [completo]);

    expect(resultados[0]).toEqual({
      idExterno: 'PED-1',
      situacao: 'duplicado',
    });
    expect(importacoes.criarPedidoImportado).not.toHaveBeenCalled();
  });

  it('trata a corrida no indice unico como duplicado', async () => {
    const { service, importacoes } = montar();
    importacoes.criarPedidoImportado.mockRejectedValue({ code: 'P2002' });

    const { resultados } = await service.importar(CANTINA, [completo]);

    expect(resultados[0].situacao).toBe('duplicado');
  });

  it('recusa item sem idExterno valido ou que nao e objeto', async () => {
    const { service, importacoes } = montar();

    const { resultados, resumo } = await service.importar(CANTINA, [
      { ...completo, idExterno: 'tem espaco' },
      'pedido em texto',
    ]);

    expect(resultados.map((r) => r.situacao)).toEqual(['invalido', 'invalido']);
    expect(resumo.invalidos).toBe(2);
    expect(importacoes.procurarPorIdExterno).not.toHaveBeenCalled();
  });

  it('processa cada item do lote de forma independente', async () => {
    const { service } = montar();

    const { resumo } = await service.importar(CANTINA, [
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
    const { service, importacoes } = montar();
    importacoes.procurarPendencia.mockResolvedValue(pendencia);

    const resultado = await service.completar(CANTINA, 7, {
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

  it('salva o progresso e responde 422 quando ainda falta dado', async () => {
    const { service, importacoes } = montar();
    importacoes.procurarPendencia.mockResolvedValue(pendencia);

    await expect(
      service.completar(CANTINA, 7, { cep: '70000001' }),
    ).rejects.toThrow(UnprocessableEntityException);
    expect(importacoes.atualizarPendencia).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ cep: '70000001' }),
      ['telefoneRecebedor'],
    );
    expect(importacoes.converterPendencia).not.toHaveBeenCalled();
  });

  it('procura a pendencia so dentro da empresa logada', async () => {
    const { service, importacoes } = montar();

    await expect(service.completar(PADARIA, 7, {})).rejects.toThrow(
      NotFoundException,
    );
    expect(importacoes.procurarPendencia).toHaveBeenCalledWith(7, PADARIA);
  });

  it('responde 404 se outra requisicao converteu a pendencia antes', async () => {
    const { service, importacoes } = montar();
    importacoes.procurarPendencia.mockResolvedValue(pendencia);
    importacoes.converterPendencia.mockRejectedValue(
      new PendenciaJaConvertida(),
    );

    await expect(
      service.completar(CANTINA, 7, {
        telefoneRecebedor: '61920000009',
        cep: '70000001',
      }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('ImportacaoService.listarPendencias', () => {
  it('lista as pendencias da empresa com os campos faltantes', async () => {
    const { service, importacoes } = montar();
    importacoes.listarPendencias.mockResolvedValue([
      importado({
        id_importacao: 7,
        id_externo: 'PED-1',
        data_recebimento: new Date('2026-10-14T12:00:00Z'),
        dados: { cep: '70000000' },
        campos_faltantes: ['cep'],
      }),
    ]);

    const pendencias = await service.listarPendencias(CANTINA);

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
