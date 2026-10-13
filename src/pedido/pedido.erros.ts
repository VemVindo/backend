// Lancados dentro da transacao para desfazer a escrita quando outra operacao
// mudou o pedido ou o entregador depois da validacao feita no service.
export class PedidoAlteradoError extends Error {}

export class EntregadorIndisponivelError extends Error {}
