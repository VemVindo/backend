import { UnprocessableEntityException } from '@nestjs/common';
import { StatusContrato, StatusPedido } from '../../generated/prisma/enums';
import { PedidoAlteradoError } from '../../pedido/pedido.erros';
import { PrismaService } from '../../prisma/prisma.service';
import { GanhoEntregaService } from '../../remuneracao/ganho-entrega.service';
import { RemocaoDaFrotaRepository } from '../remocao-da-frota.repository';

jest.mock('../../prisma/prisma.service', () => ({ PrismaService: class {} }));

const ID_EMPRESA = 7;
const CPF_REMOVIDO = '52998224725';
const ANA = { cpf: '11144477735', nome: 'Ana' };
const BRUNO = { cpf: '98765432100', nome: 'Bruno' };
const PARAMETROS = {
  taxa_fixa_atribuicao_centavos: 500,
  coeficiente_atribuicao_centavos_km: 150,
  parametros_vigentes_desde: new Date('2026-10-01T00:00:00Z'),
  remuneracao_atribuida_em: new Date('2026-10-25T12:00:00Z'),
};

function montar({
  contratoAtivo = true,
  pedidos = [] as number[],
  candidatos = [] as { cpf: string; nome: string }[],
} = {}) {
  const transacao = {
    contrato: {
      updateMany: jest.fn().mockResolvedValue({ count: contratoAtivo ? 1 : 0 }),
    },
    pedido: {
      findMany: jest
        .fn()
        .mockResolvedValue(
          pedidos.map((idPedido) => ({ id_pedido: idPedido })),
        ),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      count: jest.fn().mockResolvedValue(0),
    },
    entregador: {
      findMany: jest.fn().mockResolvedValue(candidatos),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({}),
    },
    historicoPedidoEntregadores: {
      create: jest.fn().mockResolvedValue({}),
    },
  };
  const prisma = {
    $transaction: jest.fn((callback: (cliente: typeof transacao) => unknown) =>
      callback(transacao),
    ),
  };
  const ganhos = {
    capturarParametros: jest.fn().mockResolvedValue(PARAMETROS),
  };
  const repositorio = new RemocaoDaFrotaRepository(
    prisma as unknown as PrismaService,
    ganhos as unknown as GanhoEntregaService,
  );
  return { repositorio, transacao, ganhos };
}

describe('RemocaoDaFrotaRepository.remover', () => {
  it('encerra so o contrato ativo desta empresa', async () => {
    const { repositorio, transacao } = montar();

    await repositorio.remover(ID_EMPRESA, CPF_REMOVIDO);

    expect(transacao.contrato.updateMany).toHaveBeenCalledWith({
      where: {
        idEmpresa: ID_EMPRESA,
        cpf_entregador: CPF_REMOVIDO,
        status: StatusContrato.ATIVO,
      },
      data: {
        status: StatusContrato.ENCERRADO,
        data_fim: expect.any(Date) as Date,
      },
    });
  });

  it('devolve null e nao mexe em pedidos sem vinculo ativo', async () => {
    const { repositorio, transacao } = montar({ contratoAtivo: false });

    await expect(
      repositorio.remover(ID_EMPRESA, CPF_REMOVIDO),
    ).resolves.toBeNull();
    expect(transacao.pedido.findMany).not.toHaveBeenCalled();
  });

  it('procura so as entregas em andamento desta empresa', async () => {
    const { repositorio, transacao } = montar();

    await expect(
      repositorio.remover(ID_EMPRESA, CPF_REMOVIDO),
    ).resolves.toEqual({ reatribuidos: [], pendentes: [] });
    expect(transacao.pedido.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          idEmpresa: ID_EMPRESA,
          cpf_entregador: CPF_REMOVIDO,
          status: StatusPedido.EM_ANDAMENTO,
        },
      }),
    );
    expect(transacao.entregador.findMany).not.toHaveBeenCalled();
    expect(transacao.entregador.update).not.toHaveBeenCalled();
  });

  it('busca candidatos livres da frota, sem o removido', async () => {
    const { repositorio, transacao } = montar({
      pedidos: [1],
      candidatos: [ANA],
    });

    await repositorio.remover(ID_EMPRESA, CPF_REMOVIDO);

    expect(transacao.entregador.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          cpf: { not: CPF_REMOVIDO },
          disponivel: true,
          contratos: {
            some: { idEmpresa: ID_EMPRESA, status: StatusContrato.ATIVO },
          },
        },
      }),
    );
  });

  it('passa o pedido para outro entregador livre e registra no historico', async () => {
    const { repositorio, transacao } = montar({
      pedidos: [1],
      candidatos: [ANA],
    });

    const resultado = await repositorio.remover(ID_EMPRESA, CPF_REMOVIDO);

    expect(resultado).toEqual({
      reatribuidos: [{ idPedido: 1, entregador: ANA }],
      pendentes: [],
    });
    expect(transacao.entregador.updateMany).toHaveBeenCalledWith({
      where: { cpf: ANA.cpf, disponivel: true },
      data: { disponivel: false },
    });
    expect(transacao.pedido.updateMany).toHaveBeenCalledWith({
      where: {
        id_pedido: 1,
        cpf_entregador: CPF_REMOVIDO,
        status: StatusPedido.EM_ANDAMENTO,
        ganho_consolidado_centavos: null,
      },
      data: { ...PARAMETROS, cpf_entregador: ANA.cpf },
    });
    expect(transacao.historicoPedidoEntregadores.create).toHaveBeenCalledWith({
      data: {
        id_pedido: 1,
        cpf_entregador_antigo: CPF_REMOVIDO,
        cpf_entregador_novo: ANA.cpf,
        data: expect.any(Date) as Date,
      },
    });
  });

  it('pula o candidato que outra operacao ocupou', async () => {
    const { repositorio, transacao } = montar({
      pedidos: [1],
      candidatos: [ANA, BRUNO],
    });
    transacao.entregador.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });

    const resultado = await repositorio.remover(ID_EMPRESA, CPF_REMOVIDO);

    expect(resultado?.reatribuidos).toEqual([
      { idPedido: 1, entregador: BRUNO },
    ]);
  });

  it('da um pedido por entregador e devolve o resto para PENDENTE', async () => {
    const { repositorio, transacao } = montar({
      pedidos: [1, 2],
      candidatos: [ANA],
    });

    const resultado = await repositorio.remover(ID_EMPRESA, CPF_REMOVIDO);

    expect(resultado).toEqual({
      reatribuidos: [{ idPedido: 1, entregador: ANA }],
      pendentes: [{ idPedido: 2 }],
    });
    expect(transacao.pedido.updateMany).toHaveBeenLastCalledWith({
      where: {
        id_pedido: 2,
        cpf_entregador: CPF_REMOVIDO,
        status: StatusPedido.EM_ANDAMENTO,
        ganho_consolidado_centavos: null,
      },
      data: {
        taxa_fixa_atribuicao_centavos: null,
        coeficiente_atribuicao_centavos_km: null,
        parametros_vigentes_desde: null,
        remuneracao_atribuida_em: null,
        status: StatusPedido.PENDENTE,
        cpf_entregador: null,
        data_inicio_entrega: null,
      },
    });
    expect(transacao.historicoPedidoEntregadores.create).toHaveBeenCalledTimes(
      1,
    );
  });

  it('congela os parametros vigentes uma vez para a remocao', async () => {
    const { repositorio, ganhos } = montar({
      pedidos: [1, 2],
      candidatos: [ANA, BRUNO],
    });

    await repositorio.remover(ID_EMPRESA, CPF_REMOVIDO);

    expect(ganhos.capturarParametros).toHaveBeenCalledTimes(1);
    expect(ganhos.capturarParametros).toHaveBeenCalledWith(
      expect.anything(),
      ID_EMPRESA,
      expect.any(Date),
    );
  });

  it('nao busca parametros quando nenhum pedido e reatribuido', async () => {
    const { repositorio, ganhos } = montar({ pedidos: [1] });

    await repositorio.remover(ID_EMPRESA, CPF_REMOVIDO);

    expect(ganhos.capturarParametros).not.toHaveBeenCalled();
  });

  it('falha sem parametros de remuneracao e nao grava a troca', async () => {
    const { repositorio, transacao, ganhos } = montar({
      pedidos: [1],
      candidatos: [ANA],
    });
    ganhos.capturarParametros.mockRejectedValue(
      new UnprocessableEntityException(),
    );

    await expect(
      repositorio.remover(ID_EMPRESA, CPF_REMOVIDO),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(transacao.historicoPedidoEntregadores.create).not.toHaveBeenCalled();
  });

  it('libera o removido quando ele fica sem entregas', async () => {
    const { repositorio, transacao } = montar({ pedidos: [1] });

    await repositorio.remover(ID_EMPRESA, CPF_REMOVIDO);

    expect(transacao.pedido.count).toHaveBeenCalledWith({
      where: {
        cpf_entregador: CPF_REMOVIDO,
        status: StatusPedido.EM_ANDAMENTO,
      },
    });
    expect(transacao.entregador.update).toHaveBeenCalledWith({
      where: { cpf: CPF_REMOVIDO },
      data: { disponivel: true },
    });
  });

  it('mantem o removido ocupado se ainda tem entrega de outra empresa', async () => {
    const { repositorio, transacao } = montar({ pedidos: [1] });
    transacao.pedido.count.mockResolvedValue(1);

    await repositorio.remover(ID_EMPRESA, CPF_REMOVIDO);

    expect(transacao.entregador.update).not.toHaveBeenCalled();
  });

  it('lanca PedidoAlteradoError se o pedido mudou depois da leitura', async () => {
    const { repositorio, transacao } = montar({
      pedidos: [1],
      candidatos: [ANA],
    });
    transacao.pedido.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      repositorio.remover(ID_EMPRESA, CPF_REMOVIDO),
    ).rejects.toBeInstanceOf(PedidoAlteradoError);
    expect(transacao.historicoPedidoEntregadores.create).not.toHaveBeenCalled();
  });
});
