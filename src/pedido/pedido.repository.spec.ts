import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { pedidoAtivoSelect, PedidoRepository } from './pedido.repository';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

const casos = [1, 7, 42].flatMap((id_empresa) =>
  [0, 1, 3].map((quantidade) => ({ id_empresa, quantidade })),
);

describe('PedidoRepository.listarAtivosPorEmpresa', () => {
  it.each(casos)(
    'filtra tenant $id_empresa e finalizacao nula, ordenando $quantidade pedidos por criacao DESC',
    async ({ id_empresa, quantidade }) => {
      const ativos = Array.from({ length: quantidade }, (_, indice) => ({
        id_pedido: indice + 1,
        data_criacao: new Date(Date.UTC(2026, 9, 8 - indice)),
      }));
      const findMany = jest.fn().mockResolvedValue(ativos);
      const module = await Test.createTestingModule({
        providers: [
          PedidoRepository,
          { provide: PrismaService, useValue: { pedido: { findMany } } },
        ],
      }).compile();

      await expect(
        module.get(PedidoRepository).listarAtivosPorEmpresa(id_empresa),
      ).resolves.toBe(ativos);
      expect(findMany).toHaveBeenCalledTimes(1);
      expect(findMany).toHaveBeenCalledWith({
        where: { idEmpresa: id_empresa, data_finalizacao: null },
        select: pedidoAtivoSelect,
        orderBy: { data_criacao: 'desc' },
      });
    },
  );
});
