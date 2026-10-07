import { ConflictException, NotFoundException } from '@nestjs/common';
import { StatusPedido } from '../common/enums/status-pedido.enum';
import { PedidoRepository } from './pedido.repository';
import { PedidoService } from './pedido.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class { },
}));

const CPF_ENTREGADOR = '52998224725';
const ID_PEDIDO = 1;

const pedidoPendente = {
  id_pedido: ID_PEDIDO,
  cpf_entregador: CPF_ENTREGADOR,
  status: StatusPedido.PENDENTE,
};

function montar() {
  const pedidos = {
    procurarAtribuidoAoEntregador: jest
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

  const service = new PedidoService(
    pedidos as unknown as PedidoRepository,
  );

  return { service, pedidos };
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