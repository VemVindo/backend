export const URL_WHATSAPP = 'https://wa.me';
const DDI_BRASIL = '55';

export interface DadosDaConversa {
  idPedido: number;
  empresa: string;
  entregador: string;
}

export function numeroInternacional(telefone: string): string | null {
  const digitos = telefone.replace(/\D/g, '');
  if (/^\d{10,11}$/.test(digitos)) {
    return DDI_BRASIL + digitos;
  }
  if (/^55\d{10,11}$/.test(digitos)) {
    return digitos;
  }
  return null;
}

export function montarLinkWhatsapp(
  telefone: string,
  texto: string,
): string | null {
  const numero = numeroInternacional(telefone);
  if (!numero) {
    return null;
  }
  return `${URL_WHATSAPP}/${numero}?text=${encodeURIComponent(texto)}`;
}

export function textoDaEmpresaParaEntregador(
  dados: DadosDaConversa,
): string {
  return `Olá, ${dados.entregador}! Aqui é ${dados.empresa}, sobre a entrega do pedido #${dados.idPedido}.`;
}

export function textoDoEntregadorParaEmpresa(
  dados: DadosDaConversa,
): string {
  return `Olá, ${dados.empresa}! Sou ${dados.entregador}, entregador do pedido #${dados.idPedido}.`;
}

export interface DadosDaConversaComRecebedor {
  idPedido: number;
  empresa: string;
  recebedor: string;
}

export function textoDaEmpresaParaRecebedor(
  dados: DadosDaConversaComRecebedor,
): string {
  return `Olá, ${dados.recebedor}! Aqui é ${dados.empresa}, sobre o seu pedido #${dados.idPedido}.`;
}

export function textoDoRecebedorParaEmpresa(
  dados: DadosDaConversaComRecebedor,
): string {
  return `Olá, ${dados.empresa}! Sou ${dados.recebedor}, sobre o meu pedido #${dados.idPedido}.`;
}
