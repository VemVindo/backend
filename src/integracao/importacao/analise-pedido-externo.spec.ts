import {
  analisarPedidoExterno,
  ehObjetoSimples,
  idExternoValido,
} from './analise-pedido-externo';

const completo = {
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

describe('analisarPedidoExterno', () => {
  it('aceita um pedido completo sem campos faltantes', () => {
    expect(analisarPedidoExterno(completo).camposFaltantes).toEqual([]);
  });

  it('lista os campos ausentes e os invalidos', () => {
    const { camposFaltantes } = analisarPedidoExterno({
      ...completo,
      telefoneRecebedor: '123',
      cep: undefined,
      descricao: '   ',
    });

    expect(camposFaltantes).toEqual(['telefoneRecebedor', 'cep', 'descricao']);
  });

  it('aceita complemento e observacoes ausentes', () => {
    const { camposFaltantes } = analisarPedidoExterno(completo);

    expect(camposFaltantes).not.toContain('complemento');
    expect(camposFaltantes).not.toContain('observacoes');
  });

  it('normaliza texto e UF', () => {
    const { pedido } = analisarPedidoExterno({
      ...completo,
      nomeRecebedor: '  Carla Menezes  ',
      uf: 'df',
    });

    expect(pedido.nomeRecebedor).toBe('Carla Menezes');
    expect(pedido.uf).toBe('DF');
  });

  it('guarda so os campos conhecidos do pedido', () => {
    const { dados } = analisarPedidoExterno({
      ...completo,
      idEmpresa: 2,
      status: 'FINALIZADO',
      valor_entrega: 1,
    });

    expect(dados).not.toHaveProperty('idEmpresa');
    expect(dados).not.toHaveProperty('status');
    expect(dados).not.toHaveProperty('valor_entrega');
    expect(dados.nomeRecebedor).toBe('Carla Menezes');
  });
});

describe('idExternoValido', () => {
  it.each(['PED-123', 'loja:2026.10.14_1', 'a'.repeat(100)])(
    'aceita %p',
    (valor) => {
      expect(idExternoValido(valor)).toBe(true);
    },
  );

  it.each([undefined, '', 'tem espaco', 'a'.repeat(101), 42, '../x/y'])(
    'recusa %p',
    (valor) => {
      expect(idExternoValido(valor)).toBe(false);
    },
  );
});

describe('ehObjetoSimples', () => {
  it.each([
    [{}, true],
    [[], false],
    [null, false],
    ['texto', false],
  ])('%p -> %p', (valor, esperado) => {
    expect(ehObjetoSimples(valor)).toBe(esperado);
  });
});
