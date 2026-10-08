import { PedidoEntregadorService } from './pedido-entregador.service';
import {
  formatarEndereco,
  pedidoVisivelParaEntregador,
} from './pedido-visivel-entregador';
import { PedidoComEmpresa, PedidoRepository } from './pedido.repository';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

const CPF_FICTICIO = '52998224725';
const CRIADO_EM = new Date('2026-10-07T12:00:00Z');

function pedido(dados: Partial<PedidoComEmpresa> = {}): PedidoComEmpresa {
  return {
    id_pedido: 7,
    nome_recebedor: 'Carla Menezes',
    telefone_recebedor: '61920000001',
    cep: '70000000',
    logradouro: 'Rua das Flores',
    numero: 100,
    complemento: 'Loja 1',
    bairro: 'Centro',
    cidade: 'Brasilia',
    uf: 'DF',
    descricao: 'Duas marmitas',
    status: 'EM_ANDAMENTO',
    data_criacao: CRIADO_EM,
    data_inicio_entrega: null,
    data_finalizacao: null,
    valor_entrega: 1250,
    idEmpresa: 1,
    cpf_entregador: CPF_FICTICIO,
    distancia: 3,
    empresa: { nome_fantasia: 'Cantina Dona Marta' },
    ...dados,
  };
}

describe('formatarEndereco', () => {
  it.each([
    ['Loja 1', 'Rua das Flores, 100, Loja 1 - Centro, Brasilia/DF'],
    [null, 'Rua das Flores, 100 - Centro, Brasilia/DF'],
    ['', 'Rua das Flores, 100 - Centro, Brasilia/DF'],
  ])('com complemento %p devolve "%s"', (complemento, esperado) => {
    expect(formatarEndereco(pedido({ complemento }))).toBe(esperado);
  });
});

describe('pedidoVisivelParaEntregador', () => {
  it('devolve os dados da entrega com o nome da empresa', () => {
    expect(pedidoVisivelParaEntregador(pedido())).toEqual({
      id: 7,
      status: 'EM_ANDAMENTO',
      empresa: 'Cantina Dona Marta',
      recebedor: 'Carla Menezes',
      endereco: 'Rua das Flores, 100, Loja 1 - Centro, Brasilia/DF',
      criadoEm: CRIADO_EM,
      iniciadoEm: null,
      finalizadoEm: null,
    });
  });

  it.each(['61920000001', '1250', 'Duas marmitas'])(
    'nao expoe telefone do recebedor, valor nem conteudo do pedido (%s)',
    (dadoReservado) => {
      const resposta = JSON.stringify(pedidoVisivelParaEntregador(pedido()));
      expect(resposta).not.toContain(dadoReservado);
    },
  );
});

describe('PedidoEntregadorService.listar', () => {
  it.each([
    ['nenhum pedido', [], []],
    ['um pedido', [pedido()], [7]],
    [
      'dois pedidos',
      [pedido({ id_pedido: 9 }), pedido({ id_pedido: 8 })],
      [9, 8],
    ],
  ])(
    'com %s, busca so os do entregador logado',
    async (_caso, doBanco, ids) => {
      const pedidos = {
        listarDoEntregador: jest.fn().mockResolvedValue(doBanco),
      };
      const service = new PedidoEntregadorService(
        pedidos as unknown as PedidoRepository,
      );

      const resposta = await service.listar(CPF_FICTICIO);

      expect(pedidos.listarDoEntregador).toHaveBeenCalledWith(CPF_FICTICIO);
      expect(resposta.map((item) => item.id)).toEqual(ids);
    },
  );
});
