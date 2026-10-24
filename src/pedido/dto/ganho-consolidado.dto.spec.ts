import { paraPedidoResumo } from './pedido-resumo.dto';
import { paraPedidoDoEntregador } from './pedido-do-entregador.dto';
import { paraDetalheDoPedido } from './detalhe-do-pedido.dto';
import { PedidoComEntregador, PedidoComEmpresa } from '../pedido.repository';

describe('Contratos E-US16', () => {
  it.each([null, 0, 1430])(
    'expoe ganho %s sem substituir valorEntrega',
    (ganho_consolidado_centavos) => {
      const pedido = {
        id_pedido: 1,
        valor_entrega: 999,
        ganho_consolidado_centavos: ganho_consolidado_centavos,
        distancia_conhecida: true,
        data_criacao: new Date(),
        status: 'FINALIZADO',
        entregador: null,
        empresa: { nome_fantasia: 'Empresa' },
      } as PedidoComEmpresa & PedidoComEntregador;
      for (const resposta of [
        paraPedidoResumo(pedido),
        paraPedidoDoEntregador(pedido),
        paraDetalheDoPedido(pedido),
      ]) {
        expect(resposta).toMatchObject({
          valorEntrega: 999,
          ganhoConsolidadoCentavos: ganho_consolidado_centavos,
          distanciaConhecida: true,
        });
      }
    },
  );
});
