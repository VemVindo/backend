import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AcessoComPedido, RastreioRepository } from './rastreio.repository';
import { RastreioService } from './rastreio.service';
import { gerarTokenRastreio, hashDoToken } from './token-rastreio';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

const CANTINA = 1;
const PADARIA = 2;

function pedido(status = 'EM_ANDAMENTO') {
  return {
    id_pedido: 42,
    idEmpresa: CANTINA,
    nome_recebedor: 'Carla Menezes',
    telefone_recebedor: '61920000001',
    cpf_entregador: '98765432100',
    valor_entrega: 1250,
    distancia: 3,
    descricao: 'Duas marmitas',
    status,
    data_criacao: new Date('2026-10-08T12:00:00Z'),
    logradouro: 'SQN 210 Bloco K',
    numero: 304,
    complemento: null,
    bairro: 'Asa Norte',
    cidade: 'Brasilia',
    uf: 'DF',
    cep: '70000000',
    empresa: { nome_fantasia: 'Cantina Dona Marta' },
  };
}

function acesso(status?: string) {
  return {
    idPedido: 42,
    token_hash: 'hash',
    codigo_recebedor: '012345',
    pedido: pedido(status),
  } as unknown as AcessoComPedido;
}

function montar(config: Record<string, string> = {}) {
  const repositorio = {
    salvarAcesso: jest.fn(
      (idPedido: number, tokenHash: string, codigo: string) =>
        Promise.resolve({
          idPedido,
          token_hash: tokenHash,
          codigo_recebedor: codigo,
        }),
    ),
    procurarPorTokenHash: jest.fn().mockResolvedValue(null),
    procurarPedidoDaEmpresa: jest.fn().mockResolvedValue(null),
  };
  const service = new RastreioService(
    repositorio as unknown as RastreioRepository,
    { get: (chave: string) => config[chave] } as unknown as ConfigService,
  );
  return { service, repositorio };
}

describe('RastreioService.criarAcesso', () => {
  it('devolve o link com o token e grava so o hash', async () => {
    const { service, repositorio } = montar({
      URL_FRONTEND: 'https://app.vemvindo.com/',
    });

    const { link, codigoRecebedor } = await service.criarAcesso(42);

    const token = link.split('/').pop()!;
    expect(link).toBe(`https://app.vemvindo.com/rastreio/${token}`);
    const [idPedido, hashGravado] = repositorio.salvarAcesso.mock.calls[0];
    expect(idPedido).toBe(42);
    expect(hashGravado).toBe(hashDoToken(token));
    expect(hashGravado).not.toContain(token);
    expect(codigoRecebedor).toMatch(/^\d{6}$/);
  });

  it('sem URL_FRONTEND usa o CORS_ORIGIN', async () => {
    const { service } = montar({ CORS_ORIGIN: 'http://localhost:3001' });

    const { link } = await service.criarAcesso(42);

    expect(link).toMatch(/^http:\/\/localhost:3001\/rastreio\/[\w-]{43}$/);
  });
});

describe('RastreioService.gerarNovoLink', () => {
  it('gera link novo para pedido da propria empresa', async () => {
    const { service, repositorio } = montar();
    repositorio.procurarPedidoDaEmpresa.mockResolvedValue(pedido());

    await service.gerarNovoLink(CANTINA, 42);

    expect(repositorio.procurarPedidoDaEmpresa).toHaveBeenCalledWith(
      42,
      CANTINA,
    );
    expect(repositorio.salvarAcesso).toHaveBeenCalled();
  });

  it('recusa pedido de outra empresa como se nao existisse', async () => {
    const { service, repositorio } = montar();

    await expect(service.gerarNovoLink(PADARIA, 42)).rejects.toThrow(
      NotFoundException,
    );
    expect(repositorio.salvarAcesso).not.toHaveBeenCalled();
  });

  it.each(['FINALIZADO', 'CANCELADO'])('recusa pedido %s', async (status) => {
    const { service, repositorio } = montar();
    repositorio.procurarPedidoDaEmpresa.mockResolvedValue(pedido(status));

    await expect(service.gerarNovoLink(CANTINA, 42)).rejects.toThrow(
      ConflictException,
    );
    expect(repositorio.salvarAcesso).not.toHaveBeenCalled();
  });
});

describe('RastreioService.autenticar', () => {
  it('acha o pedido pelo hash do token', async () => {
    const { service, repositorio } = montar();
    const token = gerarTokenRastreio();
    repositorio.procurarPorTokenHash.mockResolvedValue(acesso());

    const resultado = await service.autenticar(token);

    expect(resultado.situacao).toBe('valido');
    expect(repositorio.procurarPorTokenHash).toHaveBeenCalledWith(
      hashDoToken(token),
    );
  });

  it('nao consulta o banco com token de formato invalido', async () => {
    const { service, repositorio } = montar();

    await expect(service.autenticar('../../etc')).resolves.toEqual({
      situacao: 'invalido',
    });
    expect(repositorio.procurarPorTokenHash).not.toHaveBeenCalled();
  });

  it('token desconhecido e invalido', async () => {
    const { service } = montar();

    await expect(service.autenticar(gerarTokenRastreio())).resolves.toEqual({
      situacao: 'invalido',
    });
  });

  it.each(['FINALIZADO', 'CANCELADO'])(
    'expira quando o pedido fica %s',
    async (status) => {
      const { service, repositorio } = montar();
      repositorio.procurarPorTokenHash.mockResolvedValue(acesso(status));

      await expect(service.autenticar(gerarTokenRastreio())).resolves.toEqual({
        situacao: 'encerrado',
      });
    },
  );

  it.each(['PENDENTE', 'EM_ANDAMENTO'])(
    'continua valido com o pedido %s',
    async (status) => {
      const { service, repositorio } = montar();
      repositorio.procurarPorTokenHash.mockResolvedValue(acesso(status));

      const resultado = await service.autenticar(gerarTokenRastreio());

      expect(resultado.situacao).toBe('valido');
    },
  );
});

describe('RastreioService.montarPaginaDoRecebedor', () => {
  it('mostra estabelecimento, dados gerais e o codigo do recebedor', () => {
    const { service } = montar();

    const pagina = service.montarPaginaDoRecebedor(acesso());

    expect(pagina.estabelecimento).toBe('Cantina Dona Marta');
    expect(pagina.pedido).toEqual(
      expect.objectContaining({
        numero: 42,
        descricao: 'Duas marmitas',
        status: 'EM_ANDAMENTO',
      }),
    );
    expect(pagina.codigoRecebedor).toBe('012345');
  });

  it('nao expoe telefone, CPF do entregador nem valores internos', () => {
    const { service } = montar();

    const texto = JSON.stringify(service.montarPaginaDoRecebedor(acesso()));

    expect(texto).not.toContain('61920000001');
    expect(texto).not.toContain('98765432100');
    expect(texto).not.toContain('1250');
    expect(texto).not.toContain('token_hash');
  });
});
