import { AcessoRecebedor } from '../generated/prisma/client';
import {
  BLOQUEIO_CODIGO_MS,
  CodigoDoRecebedorService,
  LIMITE_TENTATIVAS_CODIGO,
} from './codigo-do-recebedor.service';
import { RastreioRepository } from './rastreio.repository';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

const ID_PEDIDO = 42;
const CODIGO = '482913';
const AGORA = new Date('2026-10-22T14:00:00Z');

function acesso(dados: Partial<AcessoRecebedor> = {}): AcessoRecebedor {
  return {
    idPedido: ID_PEDIDO,
    token_hash: 'hash',
    codigo_recebedor: CODIGO,
    data_criacao: new Date('2026-10-22T12:00:00Z'),
    tentativas_codigo: 0,
    ultima_tentativa_codigo: null,
    ...dados,
  };
}

function minutosAntes(minutos: number): Date {
  return new Date(AGORA.getTime() - minutos * 60_000);
}

function montar(encontrado: AcessoRecebedor | null = acesso()) {
  const rastreio = {
    procurarAcessoDoPedido: jest.fn().mockResolvedValue(encontrado),
    registrarTentativaErrada: jest.fn().mockResolvedValue(undefined),
  };
  const service = new CodigoDoRecebedorService(
    rastreio as unknown as RastreioRepository,
  );
  return { service, rastreio };
}

describe('CodigoDoRecebedorService.conferir', () => {
  it('aceita o codigo certo sem registrar tentativa', async () => {
    const { service, rastreio } = montar();

    await expect(service.conferir(ID_PEDIDO, CODIGO, AGORA)).resolves.toEqual({
      situacao: 'correto',
    });
    expect(rastreio.procurarAcessoDoPedido).toHaveBeenCalledWith(ID_PEDIDO);
    expect(rastreio.registrarTentativaErrada).not.toHaveBeenCalled();
  });

  it('avisa quando o pedido ainda nao tem link nem codigo', async () => {
    const { service } = montar(null);

    await expect(service.conferir(ID_PEDIDO, CODIGO, AGORA)).resolves.toEqual({
      situacao: 'sem_codigo',
    });
  });

  it('registra a tentativa errada e devolve quantas restam', async () => {
    const { service, rastreio } = montar();

    await expect(service.conferir(ID_PEDIDO, '000000', AGORA)).resolves.toEqual(
      {
        situacao: 'incorreto',
        tentativasRestantes: LIMITE_TENTATIVAS_CODIGO - 1,
      },
    );
    expect(rastreio.registrarTentativaErrada).toHaveBeenCalledWith(
      ID_PEDIDO,
      1,
      AGORA,
    );
  });

  it('soma a tentativa as erradas recentes', async () => {
    const { service, rastreio } = montar(
      acesso({
        tentativas_codigo: 3,
        ultima_tentativa_codigo: minutosAntes(2),
      }),
    );

    await expect(service.conferir(ID_PEDIDO, '000000', AGORA)).resolves.toEqual(
      {
        situacao: 'incorreto',
        tentativasRestantes: 1,
      },
    );
    expect(rastreio.registrarTentativaErrada).toHaveBeenCalledWith(
      ID_PEDIDO,
      4,
      AGORA,
    );
  });

  it('bloqueia depois do limite, mesmo com o codigo certo', async () => {
    const ultima = minutosAntes(5);
    const { service, rastreio } = montar(
      acesso({
        tentativas_codigo: LIMITE_TENTATIVAS_CODIGO,
        ultima_tentativa_codigo: ultima,
      }),
    );

    await expect(service.conferir(ID_PEDIDO, CODIGO, AGORA)).resolves.toEqual({
      situacao: 'bloqueado',
      liberaEm: new Date(ultima.getTime() + BLOQUEIO_CODIGO_MS),
    });
    expect(rastreio.registrarTentativaErrada).not.toHaveBeenCalled();
  });

  it('zera a contagem quando o bloqueio ja passou', async () => {
    const { service, rastreio } = montar(
      acesso({
        tentativas_codigo: LIMITE_TENTATIVAS_CODIGO,
        ultima_tentativa_codigo: minutosAntes(15),
      }),
    );

    await expect(service.conferir(ID_PEDIDO, '000000', AGORA)).resolves.toEqual(
      {
        situacao: 'incorreto',
        tentativasRestantes: LIMITE_TENTATIVAS_CODIGO - 1,
      },
    );
    expect(rastreio.registrarTentativaErrada).toHaveBeenCalledWith(
      ID_PEDIDO,
      1,
      AGORA,
    );
  });

  it('recusa codigo de tamanho diferente sem quebrar a comparacao', async () => {
    const { service } = montar();

    await expect(service.conferir(ID_PEDIDO, '48291', AGORA)).resolves.toEqual({
      situacao: 'incorreto',
      tentativasRestantes: LIMITE_TENTATIVAS_CODIGO - 1,
    });
  });
});
