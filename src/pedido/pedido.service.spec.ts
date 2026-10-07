import { ConflictException, NotFoundException } from '@nestjs/common';
import { StatusPedido } from '../common/enums/status-pedido.enum';
import { PedidoRepository } from './pedido.repository';
import { EntregadorRepository } from '../entregador/entregador.repository';
import { PedidoService } from './pedido.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class { },
}));

const CPF_ENTREGADOR = '52998224725';
const NOVO_CPF = '11144477735';
const ID_PEDIDO = 1;

const pedidoPendente = {
  id_pedido: ID_PEDIDO,
  cpf_entregador: CPF_ENTREGADOR,
  status: StatusPedido.PENDENTE,
};

const novoEntregador = {
  cpf: NOVO_CPF,
  disponivel: true,
};

function montar() {
  const pedidos = {
    procurarAtribuidoAoEntregador: jest
      .fn()
      .mockResolvedValue(pedidoPendente),

    procurarPorEmpresa: jest
      .fn()
      .mockResolvedValue(pedidoPendente),

    atualizarStatus: jest.fn().mockImplementation(
      async (idPedido: number, novoStatus: StatusPedido) => ({
        ...pedidoPendente,
        id_pedido: idPedido,
        status: novoStatus,
      }),
    ),
  };

  const entregadores = {
    procurarAtivoPorEmpresa: jest
      .fn()
      .mockResolvedValue(novoEntregador),
  };

  const service = new PedidoService(
    pedidos as unknown as PedidoRepository,
    entregadores as unknown as EntregadorRepository,
  );

  return {
    service,
    pedidos,
    entregadores,
  };
}

describe('PedidoService.atualizarStatus', () => {
  it('responde 404 quando o pedido nao esta atribuido ao entregador', async () => {
    const { service, pedidos } = montar();

    pedidos.procurarAtribuidoAoEntregador.mockResolvedValue(null);

    await expect(
      service.atualizarStatus(
        CPF_ENTREGADOR,
        ID_PEDIDO,
        StatusPedido.EM_ANDAMENTO,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('recusa uma transicao de status incompatível', async () => {
    const { service } = montar();

    await expect(
      service.atualizarStatus(
        CPF_ENTREGADOR,
        ID_PEDIDO,
        StatusPedido.FINALIZADO,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('aceita uma transicao de status permitida', async () => {
    const { service } = montar();

    await expect(
      service.atualizarStatus(
        CPF_ENTREGADOR,
        ID_PEDIDO,
        StatusPedido.EM_ANDAMENTO,
      ),
    ).resolves.toEqual({
      ...pedidoPendente,
      status: StatusPedido.EM_ANDAMENTO,
    });
  });

  it('busca o pedido usando o id e o cpf do entregador', async () => {
    const { service, pedidos } = montar();

    await service.atualizarStatus(
      CPF_ENTREGADOR,
      ID_PEDIDO,
      StatusPedido.EM_ANDAMENTO,
    );

    expect(
      pedidos.procurarAtribuidoAoEntregador,
    ).toHaveBeenCalledWith(
      ID_PEDIDO,
      CPF_ENTREGADOR,
    );
  });

  it('atualiza o status no repositorio quando a transicao e valida', async () => {
    const { service, pedidos } = montar();

    await service.atualizarStatus(
      CPF_ENTREGADOR,
      ID_PEDIDO,
      StatusPedido.EM_ANDAMENTO,
    );

    expect(pedidos.atualizarStatus).toHaveBeenCalledWith(
      ID_PEDIDO,
      StatusPedido.EM_ANDAMENTO,
    );
  });

  it('nao atualiza o banco quando a transicao e invalida', async () => {
    const { service, pedidos } = montar();

    await expect(
      service.atualizarStatus(
        CPF_ENTREGADOR,
        ID_PEDIDO,
        StatusPedido.FINALIZADO,
      ),
    ).rejects.toThrow(ConflictException);

    expect(pedidos.atualizarStatus).not.toHaveBeenCalled();
  });
});

describe('PedidoService.obterStatusDisponiveis', () => {
  it('retorna os status disponíveis para o pedido', async () => {
    const { service } = montar();

    await expect(
      service.obterStatusDisponiveis(
        CPF_ENTREGADOR,
        ID_PEDIDO,
      ),
    ).resolves.toEqual({
      statusAtual: StatusPedido.PENDENTE,
      statusDisponiveis: [
        StatusPedido.EM_ANDAMENTO,
      ],
    });
  });

  it('responde 404 quando o pedido nao esta atribuido ao entregador', async () => {
    const { service, pedidos } = montar();

    pedidos.procurarAtribuidoAoEntregador.mockResolvedValue(null);

    await expect(
      service.obterStatusDisponiveis(
        CPF_ENTREGADOR,
        ID_PEDIDO,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('retorna lista vazia para um pedido finalizado', async () => {
    const { service, pedidos } = montar();

    pedidos.procurarAtribuidoAoEntregador.mockResolvedValue({
      ...pedidoPendente,
      status: StatusPedido.FINALIZADO,
    });

    await expect(
      service.obterStatusDisponiveis(
        CPF_ENTREGADOR,
        ID_PEDIDO,
      ),
    ).resolves.toEqual({
      statusAtual: StatusPedido.FINALIZADO,
      statusDisponiveis: [],
    });
  });
});

describe('PedidoService.reatribuir', () => {
  it('responde 404 quando o pedido nao pertence a empresa', async () => {
    const { service, pedidos } = montar();

    pedidos.procurarPorEmpresa.mockResolvedValue(null);

    await expect(
      service.reatribuir(
        1,
        ID_PEDIDO,
        NOVO_CPF,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('recusa reatribuicao de pedido finalizado', async () => {
    const { service, pedidos } = montar();

    pedidos.procurarPorEmpresa.mockResolvedValue({
      ...pedidoPendente,
      status: StatusPedido.FINALIZADO,
    });

    await expect(
      service.reatribuir(
        1,
        ID_PEDIDO,
        NOVO_CPF,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('recusa reatribuicao de pedido cancelado', async () => {
    const { service, pedidos } = montar();

    pedidos.procurarPorEmpresa.mockResolvedValue({
      ...pedidoPendente,
      status: StatusPedido.CANCELADO,
    });

    await expect(
      service.reatribuir(
        1,
        ID_PEDIDO,
        NOVO_CPF,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('recusa reatribuicao quando o pedido nao possui entregador atual', async () => {
    const { service, pedidos } = montar();

    pedidos.procurarPorEmpresa.mockResolvedValue({
      ...pedidoPendente,
      cpf_entregador: null,
    });

    await expect(
      service.reatribuir(
        1,
        ID_PEDIDO,
        NOVO_CPF,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('recusa reatribuicao para o entregador atual', async () => {
    const { service } = montar();

    await expect(
      service.reatribuir(
        1,
        ID_PEDIDO,
        CPF_ENTREGADOR,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('responde 404 quando o novo entregador nao possui vinculo ativo com a empresa', async () => {
    const { service, entregadores } = montar();

    entregadores.procurarAtivoPorEmpresa.mockResolvedValue(null);

    await expect(
      service.reatribuir(
        1,
        ID_PEDIDO,
        NOVO_CPF,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('recusa reatribuicao quando o novo entregador esta indisponivel', async () => {
    const { service, entregadores } = montar();

    entregadores.procurarAtivoPorEmpresa.mockResolvedValue({
      ...novoEntregador,
      disponivel: false,
    });

    await expect(
      service.reatribuir(
        1,
        ID_PEDIDO,
        NOVO_CPF,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('aceita reatribuicao quando todas as regras sao atendidas', async () => {
    const { service } = montar();

    await expect(
      service.reatribuir(
        1,
        ID_PEDIDO,
        NOVO_CPF,
      ),
    ).resolves.toEqual({
      pedido: pedidoPendente,
      novoEntregador,
    });
  });
});