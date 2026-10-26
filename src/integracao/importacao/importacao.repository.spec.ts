import { SituacaoImportacao, StatusPedido } from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import type { DadosPedidoExterno } from './analise-pedido-externo';
import {
  DadosNovoPedido,
  ImportacaoRepository,
  PendenciaJaConvertida,
} from './importacao.repository';

jest.mock('../../prisma/prisma.service', () => ({ PrismaService: class {} }));

const DADOS_EXTERNOS = { nome_recebedor: 'Maria' } as DadosPedidoExterno;
const NOVO_PEDIDO = {
  nome_recebedor: 'Maria',
  status: StatusPedido.PENDENTE,
} as DadosNovoPedido;

function montar() {
  const transacao = {
    pedido: { create: jest.fn().mockResolvedValue({ id_pedido: 99 }) },
    pedidoImportado: {
      create: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const prisma = {
    pedidoImportado: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id_importacao: 3 }),
      update: jest.fn().mockResolvedValue({ id_importacao: 3 }),
    },
    metricasPagamento: { findFirst: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn(
      (operacao: (cliente: typeof transacao) => Promise<unknown>) =>
        operacao(transacao),
    ),
  };
  return {
    repo: new ImportacaoRepository(prisma as unknown as PrismaService),
    prisma,
    transacao,
  };
}

describe('ImportacaoRepository', () => {
  it('procura a importacao pelo id externo dentro da empresa', async () => {
    const { repo, prisma } = montar();

    await expect(repo.procurarPorIdExterno(7, 'A1')).resolves.toBeNull();
    expect(prisma.pedidoImportado.findUnique).toHaveBeenCalledWith({
      where: { idEmpresa_id_externo: { idEmpresa: 7, id_externo: 'A1' } },
    });
  });

  it('busca as metricas de pagamento mais recentes ate agora', async () => {
    const { repo, prisma } = montar();
    const agora = new Date('2026-10-25T12:00:00Z');

    await repo.procurarMetricasVigentes(7, agora);

    expect(prisma.metricasPagamento.findFirst).toHaveBeenCalledWith({
      where: { idEmpresa: 7, data: { lte: agora } },
      orderBy: { data: 'desc' },
    });
  });

  it('cria a pendencia com os campos que faltam', async () => {
    const { repo, prisma } = montar();

    await expect(
      repo.criarPendencia(7, 'A1', DADOS_EXTERNOS, ['cep']),
    ).resolves.toEqual({ id_importacao: 3 });
    expect(prisma.pedidoImportado.create).toHaveBeenCalledWith({
      data: {
        idEmpresa: 7,
        id_externo: 'A1',
        dados: DADOS_EXTERNOS,
        campos_faltantes: ['cep'],
      },
    });
  });

  it('cria o pedido e a importacao convertida na mesma transacao', async () => {
    const { repo, transacao } = montar();

    await expect(
      repo.criarPedidoImportado(7, 'A1', DADOS_EXTERNOS, NOVO_PEDIDO),
    ).resolves.toEqual({ id_pedido: 99 });
    expect(transacao.pedido.create).toHaveBeenCalledWith({
      data: { ...NOVO_PEDIDO, idEmpresa: 7 },
    });
    expect(transacao.pedidoImportado.create).toHaveBeenCalledWith({
      data: {
        idEmpresa: 7,
        id_externo: 'A1',
        dados: DADOS_EXTERNOS,
        campos_faltantes: [],
        situacao: SituacaoImportacao.CONVERTIDO,
        idPedido: 99,
      },
    });
  });

  it('lista as pendencias da empresa da mais antiga para a mais nova', async () => {
    const { repo, prisma } = montar();

    await repo.listarPendencias(7);

    expect(prisma.pedidoImportado.findMany).toHaveBeenCalledWith({
      where: {
        idEmpresa: 7,
        situacao: SituacaoImportacao.AGUARDANDO_COMPLETUDE,
      },
      orderBy: { data_recebimento: 'asc' },
    });
  });

  it('procura so pendencia ainda aguardando, dentro da empresa', async () => {
    const { repo, prisma } = montar();

    await expect(repo.procurarPendencia(3, 7)).resolves.toBeNull();
    expect(prisma.pedidoImportado.findFirst).toHaveBeenCalledWith({
      where: {
        id_importacao: 3,
        idEmpresa: 7,
        situacao: SituacaoImportacao.AGUARDANDO_COMPLETUDE,
      },
    });
  });

  it('atualiza os dados e os campos que ainda faltam', async () => {
    const { repo, prisma } = montar();

    await repo.atualizarPendencia(3, DADOS_EXTERNOS, ['numero']);

    expect(prisma.pedidoImportado.update).toHaveBeenCalledWith({
      where: { id_importacao: 3 },
      data: { dados: DADOS_EXTERNOS, campos_faltantes: ['numero'] },
    });
  });

  it('converte a pendencia em pedido', async () => {
    const { repo, transacao } = montar();

    await expect(
      repo.converterPendencia(3, 7, DADOS_EXTERNOS, NOVO_PEDIDO),
    ).resolves.toEqual({ id_pedido: 99 });
    expect(transacao.pedidoImportado.updateMany).toHaveBeenCalledWith({
      where: {
        id_importacao: 3,
        idEmpresa: 7,
        situacao: SituacaoImportacao.AGUARDANDO_COMPLETUDE,
      },
      data: {
        dados: DADOS_EXTERNOS,
        campos_faltantes: [],
        situacao: SituacaoImportacao.CONVERTIDO,
        idPedido: 99,
      },
    });
  });

  it('desfaz a conversao quando outra requisicao converteu antes', async () => {
    const { repo, transacao } = montar();
    transacao.pedidoImportado.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      repo.converterPendencia(3, 7, DADOS_EXTERNOS, NOVO_PEDIDO),
    ).rejects.toBeInstanceOf(PendenciaJaConvertida);
  });
});
