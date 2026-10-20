import { AcessoComPedido, RastreioRepository } from './rastreio.repository';
import { gerarTokenRastreio, hashDoToken } from './token-rastreio';
import { ValidadorDeLink } from './validador-de-link';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

function acesso(status: string) {
  return {
    idPedido: 42,
    token_hash: 'hash',
    codigo_recebedor: '012345',
    pedido: { id_pedido: 42, status },
  } as unknown as AcessoComPedido;
}

function montar() {
  const repositorio = {
    procurarPorTokenHash: jest.fn().mockResolvedValue(null),
  };
  const validador = new ValidadorDeLink(
    repositorio as unknown as RastreioRepository,
  );
  return { validador, repositorio };
}

describe('ValidadorDeLink.autenticar', () => {
  it('acha o pedido pelo hash do token', async () => {
    const { validador, repositorio } = montar();
    const token = gerarTokenRastreio();
    repositorio.procurarPorTokenHash.mockResolvedValue(acesso('EM_ANDAMENTO'));

    const resultado = await validador.autenticar(token);

    expect(resultado.situacao).toBe('valido');
    expect(repositorio.procurarPorTokenHash).toHaveBeenCalledWith(
      hashDoToken(token),
    );
  });

  it('nao consulta o banco com token de formato invalido', async () => {
    const { validador, repositorio } = montar();

    await expect(validador.autenticar('../../etc')).resolves.toEqual({
      situacao: 'invalido',
    });
    expect(repositorio.procurarPorTokenHash).not.toHaveBeenCalled();
  });

  it('token desconhecido e invalido', async () => {
    const { validador } = montar();

    await expect(validador.autenticar(gerarTokenRastreio())).resolves.toEqual({
      situacao: 'invalido',
    });
  });

  it.each(['FINALIZADO', 'CANCELADO'])(
    'expira quando o pedido fica %s',
    async (status) => {
      const { validador, repositorio } = montar();
      repositorio.procurarPorTokenHash.mockResolvedValue(acesso(status));

      await expect(validador.autenticar(gerarTokenRastreio())).resolves.toEqual(
        { situacao: 'encerrado' },
      );
    },
  );

  it.each(['PENDENTE', 'EM_ANDAMENTO'])(
    'continua valido com o pedido %s',
    async (status) => {
      const { validador, repositorio } = montar();
      repositorio.procurarPorTokenHash.mockResolvedValue(acesso(status));

      const resultado = await validador.autenticar(gerarTokenRastreio());

      expect(resultado.situacao).toBe('valido');
    },
  );
});
