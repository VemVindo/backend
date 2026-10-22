import { StatusPedido } from '../generated/prisma/enums';
import { linhaDoTempo } from './linha-do-tempo';

const CRIADO = new Date('2026-10-20T12:00:00Z');
const INICIO = new Date('2026-10-20T12:10:00Z');
const FIM = new Date('2026-10-20T12:40:00Z');

describe('linhaDoTempo', () => {
  it('pedido pendente so tem a criacao', () => {
    expect(
      linhaDoTempo({
        status: StatusPedido.PENDENTE,
        data_criacao: CRIADO,
        data_inicio_entrega: null,
        data_finalizacao: null,
      }),
    ).toEqual([{ etapa: 'CRIADO', em: CRIADO }]);
  });

  it('pedido em andamento mostra quando saiu para entrega', () => {
    expect(
      linhaDoTempo({
        status: StatusPedido.EM_ANDAMENTO,
        data_criacao: CRIADO,
        data_inicio_entrega: INICIO,
        data_finalizacao: null,
      }),
    ).toEqual([
      { etapa: 'CRIADO', em: CRIADO },
      { etapa: StatusPedido.EM_ANDAMENTO, em: INICIO },
    ]);
  });

  it.each([StatusPedido.FINALIZADO, StatusPedido.CANCELADO])(
    'pedido %s fecha com o status final e o horario',
    (status) => {
      expect(
        linhaDoTempo({
          status,
          data_criacao: CRIADO,
          data_inicio_entrega: INICIO,
          data_finalizacao: FIM,
        }).at(-1),
      ).toEqual({ etapa: status, em: FIM });
    },
  );

  it('cancelado antes de sair nao inventa o inicio da entrega', () => {
    expect(
      linhaDoTempo({
        status: StatusPedido.CANCELADO,
        data_criacao: CRIADO,
        data_inicio_entrega: null,
        data_finalizacao: FIM,
      }),
    ).toEqual([
      { etapa: 'CRIADO', em: CRIADO },
      { etapa: StatusPedido.CANCELADO, em: FIM },
    ]);
  });
});
