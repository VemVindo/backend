import { Test } from '@nestjs/testing';
import { PedidoRepository } from './pedido.repository';
import { PedidoService } from './pedido.service';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

const casos = [1, 7, 42].flatMap((id_empresa) =>
  [0, 1, 3].map((quantidade) => ({ id_empresa, quantidade })),
);

describe('PedidoService.listarAtivos', () => {
  it.each(casos)(
    'consulta o tenant $id_empresa e preserva $quantidade pedidos em ordem',
    async ({ id_empresa, quantidade }) => {
      const ativos = Array.from({ length: quantidade }, (_, indice) => ({
        id_pedido: indice + 1,
        data_criacao: new Date(Date.UTC(2026, 9, 8 - indice)),
      }));
      const listarAtivosPorEmpresa = jest.fn().mockResolvedValue(ativos);
      const module = await Test.createTestingModule({
        providers: [
          PedidoService,
          { provide: PedidoRepository, useValue: { listarAtivosPorEmpresa } },
        ],
      }).compile();

      await expect(
        module.get(PedidoService).listarAtivos(id_empresa),
      ).resolves.toBe(ativos);
      expect(listarAtivosPorEmpresa).toHaveBeenCalledTimes(1);
      expect(listarAtivosPorEmpresa).toHaveBeenCalledWith(id_empresa);
    },
  );
});
