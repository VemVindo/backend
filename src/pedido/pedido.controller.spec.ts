import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CARGOS_KEY } from '../auth/decorators/cargos.decorator';
import type { UsuarioAutenticado } from '../auth/jwt.strategy';
import { Cargo } from '../common/enums/cargo.enum';
import { PedidoController } from './pedido.controller';
import { PedidoService } from './pedido.service';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

const casos = ['1', '7', '42'].flatMap((empresaId) =>
  [0, 1, 3].map((quantidade) => ({ empresaId, quantidade })),
);

describe('PedidoController.listarAtivos', () => {
  it.each(casos)(
    'propaga o tenant $empresaId e retorna $quantidade pedidos',
    async ({ empresaId, quantidade }) => {
      const ativos = Array.from({ length: quantidade }, (_, indice) => ({
        id_pedido: indice + 1,
        data_criacao: new Date(Date.UTC(2026, 9, 8 - indice)),
      }));
      const listarAtivos = jest.fn().mockResolvedValue(ativos);
      const module = await Test.createTestingModule({
        controllers: [PedidoController],
        providers: [{ provide: PedidoService, useValue: { listarAtivos } }],
      }).compile();
      const controller = module.get(PedidoController);
      const usuario = {
        usuarioId: '999',
        empresaId,
        cargo: Cargo.ESTABELECIMENTO,
        id_empresa: 999,
      };

      await expect(controller.listarAtivos(usuario)).resolves.toBe(ativos);
      expect(listarAtivos).toHaveBeenCalledTimes(1);
      expect(listarAtivos).toHaveBeenCalledWith(Number(empresaId));
    },
  );

  it.each([
    undefined,
    '',
    'abc',
    '0',
    '-1',
    '1.5',
    'Infinity',
    '9007199254740992',
  ])('recusa tenant invalido %s sem consultar o service', async (empresaId) => {
    const listarAtivos = jest.fn();
    const module = await Test.createTestingModule({
      controllers: [PedidoController],
      providers: [{ provide: PedidoService, useValue: { listarAtivos } }],
    }).compile();
    const usuario: UsuarioAutenticado = {
      usuarioId: '999',
      empresaId,
      cargo: Cargo.ESTABELECIMENTO,
    };

    expect(() => module.get(PedidoController).listarAtivos(usuario)).toThrow(
      UnauthorizedException,
    );
    expect(listarAtivos).not.toHaveBeenCalled();
  });

  it.each(['listarAtivos'])(
    'restringe a operacao ao estabelecimento',
    (nome) => {
      const operacao: unknown = Object.getOwnPropertyDescriptor(
        PedidoController.prototype,
        nome,
      )?.value;
      if (typeof operacao !== 'function') {
        throw new Error('Operacao nao encontrada');
      }
      expect(Reflect.getMetadata(CARGOS_KEY, operacao)).toEqual([
        Cargo.ESTABELECIMENTO,
      ]);
    },
  );
});
