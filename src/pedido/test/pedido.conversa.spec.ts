import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { StatusPedido } from '../../generated/prisma/enums';
import { ConversaDoPedidoService } from '../conversa-do-pedido.service';
import { PedidoComContatos, PedidoRepository } from '../pedido.repository';

jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: class {},
}));

const ID_EMPRESA = 3;
const ID_PEDIDO = 12;
const CPF = '52998224725';

function pedido(parcial: Partial<PedidoComContatos> = {}): PedidoComContatos {
  return {
    id_pedido: ID_PEDIDO,
    status: StatusPedido.EM_ANDAMENTO,
    idEmpresa: ID_EMPRESA,
    cpf_entregador: CPF,
    logradouro: 'Rua das Flores',
    numero: 10,
    complemento: null,
    bairro: 'Centro',
    cidade: 'Brasilia',
    uf: 'DF',
    empresa: { nome_fantasia: 'Padaria Sol', telefone: '6132345678' },
    entregador: { nome: 'Joao Silva', telefone: '61987654321' },
    ...parcial,
  } as PedidoComContatos;
}

function montar(encontrado: PedidoComContatos | null = pedido()) {
  const pedidos = {
    procurarComContatos: jest.fn().mockResolvedValue(encontrado),
  };
  const servico = new ConversaDoPedidoService(
    pedidos as unknown as PedidoRepository,
  );
  return { servico, pedidos };
}

describe('ConversaDoPedidoService conversa pelo WhatsApp (E-US20 + EN-US07)', () => {
  it('a empresa recebe o link para o telefone do entregador atual', async () => {
    const { servico, pedidos } = montar();

    const conversa = await servico.conversaComEntregador(ID_EMPRESA, ID_PEDIDO);

    expect(pedidos.procurarComContatos).toHaveBeenCalledWith(ID_PEDIDO, {
      idEmpresa: ID_EMPRESA,
    });
    expect(conversa.contato).toBe('Joao Silva');
    expect(conversa.link).toMatch(/^https:\/\/wa\.me\/5561987654321\?text=/);
    const texto = decodeURIComponent(conversa.link);
    expect(texto).toContain('pedido #12');
    expect(texto).not.toContain('Rua das Flores');
  });

  it('o entregador recebe o link para o telefone do estabelecimento', async () => {
    const { servico, pedidos } = montar();

    const conversa = await servico.conversaComEstabelecimento(CPF, ID_PEDIDO);

    expect(pedidos.procurarComContatos).toHaveBeenCalledWith(ID_PEDIDO, {
      cpf_entregador: CPF,
    });
    expect(conversa.contato).toBe('Padaria Sol');
    expect(conversa.link).toMatch(/^https:\/\/wa\.me\/556132345678\?text=/);
  });

  it('pedido de outra empresa ou de outro entregador vira 404', async () => {
    const { servico } = montar(null);

    await expect(
      servico.conversaComEntregador(ID_EMPRESA, ID_PEDIDO),
    ).rejects.toThrow(NotFoundException);
    await expect(
      servico.conversaComEstabelecimento(CPF, ID_PEDIDO),
    ).rejects.toThrow(NotFoundException);
  });

  it.each([
    StatusPedido.PENDENTE,
    StatusPedido.FINALIZADO,
    StatusPedido.CANCELADO,
  ])('recusa a conversa com o pedido %s', async (status) => {
    const { servico } = montar(pedido({ status }));

    await expect(
      servico.conversaComEntregador(ID_EMPRESA, ID_PEDIDO),
    ).rejects.toThrow(ConflictException);
  });

  it('recusa a conversa sem entregador atribuido', async () => {
    const { servico } = montar(pedido({ entregador: null }));

    await expect(
      servico.conversaComEntregador(ID_EMPRESA, ID_PEDIDO),
    ).rejects.toThrow(ConflictException);
  });

  it('avisa quando o telefone cadastrado nao serve para o WhatsApp', async () => {
    const { servico } = montar(
      pedido({ entregador: { nome: 'Joao Silva', telefone: '123' } }),
    );

    await expect(
      servico.conversaComEntregador(ID_EMPRESA, ID_PEDIDO),
    ).rejects.toThrow(UnprocessableEntityException);
  });
});

describe('ConversaDoPedidoService conversa com o recebedor pelo WhatsApp (E-US19)', () => {
  const COM_RECEBEDOR = {
    nome_recebedor: 'Carla Menezes',
    telefone_recebedor: '61920000001',
  };

  it('a empresa recebe o link para o telefone do recebedor', async () => {
    const { servico, pedidos } = montar(pedido(COM_RECEBEDOR));

    const conversa = await servico.conversaComRecebedor(ID_EMPRESA, ID_PEDIDO);

    expect(pedidos.procurarComContatos).toHaveBeenCalledWith(ID_PEDIDO, {
      idEmpresa: ID_EMPRESA,
    });
    expect(conversa.contato).toBe('Carla Menezes');
    expect(conversa.link).toMatch(/^https:\/\/wa\.me\/5561920000001\?text=/);
    expect(decodeURIComponent(conversa.link)).toContain('pedido #12');
  });

  it('libera a conversa antes de o pedido ter entregador', async () => {
    const { servico } = montar(
      pedido({
        ...COM_RECEBEDOR,
        status: StatusPedido.PENDENTE,
        entregador: null,
      }),
    );

    await expect(
      servico.conversaComRecebedor(ID_EMPRESA, ID_PEDIDO),
    ).resolves.toEqual(expect.objectContaining({ contato: 'Carla Menezes' }));
  });

  it('pedido de outra empresa vira 404', async () => {
    const { servico } = montar(null);

    await expect(
      servico.conversaComRecebedor(ID_EMPRESA, ID_PEDIDO),
    ).rejects.toThrow(NotFoundException);
  });

  it.each([StatusPedido.FINALIZADO, StatusPedido.CANCELADO])(
    'recusa a conversa com o pedido %s',
    async (status) => {
      const { servico } = montar(pedido({ ...COM_RECEBEDOR, status }));

      await expect(
        servico.conversaComRecebedor(ID_EMPRESA, ID_PEDIDO),
      ).rejects.toThrow(ConflictException);
    },
  );

  it('avisa quando o telefone do recebedor nao serve para o WhatsApp', async () => {
    const { servico } = montar(
      pedido({ ...COM_RECEBEDOR, telefone_recebedor: '123' }),
    );

    await expect(
      servico.conversaComRecebedor(ID_EMPRESA, ID_PEDIDO),
    ).rejects.toThrow(UnprocessableEntityException);
  });
});
