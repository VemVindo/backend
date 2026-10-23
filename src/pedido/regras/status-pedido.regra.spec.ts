import { StatusPedido } from '../../generated/prisma/enums';
import {
  exigeCodigoDoRecebedor,
  obterStatusDisponiveis,
  statusFinal,
  transicaoPermitida,
} from './status-pedido.regra';

describe('obterStatusDisponiveis', () => {
  it('permite ir de PENDENTE para EM_ANDAMENTO', () => {
    expect(obterStatusDisponiveis(StatusPedido.PENDENTE)).toEqual([
      StatusPedido.EM_ANDAMENTO,
    ]);
  });

  it('nao oferece FINALIZADO como troca simples, porque ele pede o codigo do recebedor', () => {
    expect(obterStatusDisponiveis(StatusPedido.EM_ANDAMENTO)).toEqual([]);
  });

  it('nao permite novas transicoes a partir de FINALIZADO', () => {
    expect(obterStatusDisponiveis(StatusPedido.FINALIZADO)).toEqual([]);
  });

  it('nao permite novas transicoes a partir de CANCELADO', () => {
    expect(obterStatusDisponiveis(StatusPedido.CANCELADO)).toEqual([]);
  });
});

describe('exigeCodigoDoRecebedor', () => {
  it('exige o codigo para finalizar', () => {
    expect(exigeCodigoDoRecebedor(StatusPedido.FINALIZADO)).toBe(true);
  });

  it.each([StatusPedido.EM_ANDAMENTO, StatusPedido.CANCELADO])(
    'nao exige o codigo para %s',
    (status) => {
      expect(exigeCodigoDoRecebedor(status)).toBe(false);
    },
  );
});

describe('transicaoPermitida', () => {
  it('aceita uma transicao valida', () => {
    expect(
      transicaoPermitida(StatusPedido.PENDENTE, StatusPedido.EM_ANDAMENTO),
    ).toBe(true);
  });

  it('recusa pular de PENDENTE direto para FINALIZADO', () => {
    expect(
      transicaoPermitida(StatusPedido.PENDENTE, StatusPedido.FINALIZADO),
    ).toBe(false);
  });

  it('recusa voltar de EM_ANDAMENTO para PENDENTE', () => {
    expect(
      transicaoPermitida(StatusPedido.EM_ANDAMENTO, StatusPedido.PENDENTE),
    ).toBe(false);
  });

  it('recusa alterar um pedido FINALIZADO', () => {
    expect(
      transicaoPermitida(StatusPedido.FINALIZADO, StatusPedido.EM_ANDAMENTO),
    ).toBe(false);
  });

  it('recusa alterar um pedido CANCELADO', () => {
    expect(
      transicaoPermitida(StatusPedido.CANCELADO, StatusPedido.EM_ANDAMENTO),
    ).toBe(false);
  });
});

describe('statusFinal', () => {
  it('considera FINALIZADO e CANCELADO como finais', () => {
    expect(statusFinal(StatusPedido.FINALIZADO)).toBe(true);
    expect(statusFinal(StatusPedido.CANCELADO)).toBe(true);
  });

  it('nao considera PENDENTE e EM_ANDAMENTO como finais', () => {
    expect(statusFinal(StatusPedido.PENDENTE)).toBe(false);
    expect(statusFinal(StatusPedido.EM_ANDAMENTO)).toBe(false);
  });
});
