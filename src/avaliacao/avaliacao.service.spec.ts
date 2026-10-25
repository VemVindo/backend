import { ConflictException, GoneException } from '@nestjs/common';
import { StatusPedido } from '../generated/prisma/enums';
import type { AcessoComPedido } from '../rastreio/rastreio.repository';
import { AvaliacaoRepository } from './avaliacao.repository';
import { AvaliacaoService, PRAZO_PARA_AVALIAR_MS } from './avaliacao.service';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

const FIM = new Date('2026-10-20T12:00:00Z');
const AGORA = new Date('2026-10-20T13:00:00Z');
const DEPOIS_DO_PRAZO = new Date(FIM.getTime() + PRAZO_PARA_AVALIAR_MS + 1);

function acesso(
  status: StatusPedido = StatusPedido.FINALIZADO,
  dataFinalizacao: Date | null = FIM,
) {
  return {
    idPedido: 42,
    pedido: { status, data_finalizacao: dataFinalizacao },
  } as unknown as AcessoComPedido;
}

const AVALIACAO = {
  idpedidos: 42,
  avaliacao_entrega: 4,
  comentario: null as string | null,
  data: AGORA,
};

function montar(existente: typeof AVALIACAO | null = null) {
  const repositorio = {
    procurar: jest.fn().mockResolvedValue(existente),
    criar: jest.fn((idPedido: number, nota: number, data: Date) =>
      Promise.resolve({
        idpedidos: idPedido,
        avaliacao_entrega: nota,
        comentario: null,
        data,
      }),
    ),
    registrarComentario: jest.fn().mockResolvedValue(true),
    listarDaEmpresa: jest.fn().mockResolvedValue([]),
  };
  const service = new AvaliacaoService(
    repositorio as unknown as AvaliacaoRepository,
  );
  return { service, repositorio };
}

describe('AvaliacaoService.consultar', () => {
  it.each([
    ['aguardando', acesso(StatusPedido.EM_ANDAMENTO, null), null, AGORA],
    ['aguardando', acesso(StatusPedido.PENDENTE, null), null, AGORA],
    ['indisponivel', acesso(StatusPedido.CANCELADO), null, AGORA],
    ['disponivel', acesso(), null, AGORA],
    ['expirada', acesso(), null, DEPOIS_DO_PRAZO],
    ['avaliado', acesso(), AVALIACAO, DEPOIS_DO_PRAZO],
  ])('situacao %s', async (esperada, link, existente, agora) => {
    const { service } = montar(existente);

    await expect(service.consultar(link, agora)).resolves.toMatchObject({
      situacao: esperada,
    });
  });

  it('devolve a nota e o comentario ja enviados', async () => {
    const { service } = montar({ ...AVALIACAO, comentario: 'Rapido' });

    await expect(service.consultar(acesso(), AGORA)).resolves.toEqual({
      situacao: 'avaliado',
      avaliacao: { nota: 4, comentario: 'Rapido', data: AGORA },
    });
  });
});

describe('AvaliacaoService.avaliar', () => {
  it('grava a nota com a data da avaliacao', async () => {
    const { service, repositorio } = montar();

    const resposta = await service.avaliar(acesso(), 5, AGORA);

    expect(repositorio.criar).toHaveBeenCalledWith(42, 5, AGORA);
    expect(resposta).toEqual({
      situacao: 'avaliado',
      avaliacao: { nota: 5, comentario: null, data: AGORA },
    });
  });

  it.each([
    {
      caso: 'ja avaliada',
      link: acesso(),
      existente: AVALIACAO,
      agora: AGORA,
      erro: ConflictException,
    },
    {
      caso: 'em andamento',
      link: acesso(StatusPedido.EM_ANDAMENTO, null),
      existente: null,
      agora: AGORA,
      erro: ConflictException,
    },
    {
      caso: 'cancelada',
      link: acesso(StatusPedido.CANCELADO),
      existente: null,
      agora: AGORA,
      erro: GoneException,
    },
    {
      caso: 'fora do prazo',
      link: acesso(),
      existente: null,
      agora: DEPOIS_DO_PRAZO,
      erro: GoneException,
    },
  ])(
    'recusa entrega $caso sem gravar',
    async ({ link, existente, agora, erro }) => {
      const { service, repositorio } = montar(existente);

      await expect(service.avaliar(link, 5, agora)).rejects.toThrow(erro);
      expect(repositorio.criar).not.toHaveBeenCalled();
    },
  );

  it('responde 409 quando duas notas chegam juntas', async () => {
    const { service, repositorio } = montar();
    repositorio.criar.mockRejectedValue({ code: 'P2002' });

    await expect(service.avaliar(acesso(), 5, AGORA)).rejects.toThrow(
      ConflictException,
    );
  });

  it('repassa outros erros do banco', async () => {
    const { service, repositorio } = montar();
    const falha = new Error('conexao perdida');
    repositorio.criar.mockRejectedValue(falha);

    await expect(service.avaliar(acesso(), 5, AGORA)).rejects.toBe(falha);
  });
});

describe('AvaliacaoService.comentar', () => {
  it('grava o comentario depois da nota', async () => {
    const { service, repositorio } = montar(AVALIACAO);

    const resposta = await service.comentar(acesso(), 'Chegou quente', AGORA);

    expect(repositorio.registrarComentario).toHaveBeenCalledWith(
      42,
      'Chegou quente',
    );
    expect(resposta.avaliacao).toEqual({
      nota: 4,
      comentario: 'Chegou quente',
      data: AGORA,
    });
  });

  it('exige a nota antes', async () => {
    const { service } = montar(null);

    await expect(service.comentar(acesso(), 'Oi', AGORA)).rejects.toThrow(
      ConflictException,
    );
  });

  it('recusa o segundo comentario', async () => {
    const { service, repositorio } = montar(AVALIACAO);
    repositorio.registrarComentario.mockResolvedValue(false);

    await expect(service.comentar(acesso(), 'De novo', AGORA)).rejects.toThrow(
      ConflictException,
    );
  });

  it('recusa depois do prazo', async () => {
    const { service, repositorio } = montar(AVALIACAO);

    await expect(
      service.comentar(acesso(), 'Tarde', DEPOIS_DO_PRAZO),
    ).rejects.toThrow(GoneException);
    expect(repositorio.registrarComentario).not.toHaveBeenCalled();
  });
});

describe('AvaliacaoService.listarDaEmpresa', () => {
  it('devolve nota, comentario, data, pedido e entregador', async () => {
    const { service, repositorio } = montar();
    repositorio.listarDaEmpresa.mockResolvedValue([
      {
        ...AVALIACAO,
        comentario: 'Otimo',
        pedido: { id_pedido: 42, entregador: { nome: 'Bruno Lima' } },
      },
      {
        ...AVALIACAO,
        idpedidos: 43,
        pedido: { id_pedido: 43, entregador: null },
      },
    ]);
    const filtro = { notas: [4, 5] };

    const lista = await service.listarDaEmpresa(3, filtro);

    expect(repositorio.listarDaEmpresa).toHaveBeenCalledWith(3, filtro);
    expect(lista).toEqual([
      {
        idPedido: 42,
        nota: 4,
        comentario: 'Otimo',
        data: AGORA,
        entregador: 'Bruno Lima',
      },
      {
        idPedido: 43,
        nota: 4,
        comentario: null,
        data: AGORA,
        entregador: null,
      },
    ]);
  });
});
