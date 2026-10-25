import type { PedidoComEmpresa } from '../pedido.repository';
import { formatarEndereco } from './pedido-do-entregador.dto';

const ENDERECO = {
  logradouro: 'SQN 210 Bloco K',
  numero: 10,
  bairro: 'Asa Norte',
  cidade: 'Brasilia',
  uf: 'DF',
};

function pedido(complemento: string | null) {
  return { ...ENDERECO, complemento } as PedidoComEmpresa;
}

describe('formatarEndereco', () => {
  it('inclui o complemento depois do numero', () => {
    expect(formatarEndereco(pedido('Apto 101'))).toBe(
      'SQN 210 Bloco K, 10, Apto 101 - Asa Norte, Brasilia/DF',
    );
  });

  it('omite o complemento vazio', () => {
    expect(formatarEndereco(pedido(null))).toBe(
      'SQN 210 Bloco K, 10 - Asa Norte, Brasilia/DF',
    );
    expect(formatarEndereco(pedido(''))).toBe(
      'SQN 210 Bloco K, 10 - Asa Norte, Brasilia/DF',
    );
  });
});
