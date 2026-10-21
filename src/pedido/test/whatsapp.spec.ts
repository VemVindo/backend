import {
  montarLinkWhatsapp,
  numeroInternacional,
  textoParaEntregador,
  textoParaEstabelecimento,
} from '../whatsapp';

const DADOS = {
  idPedido: 12,
  empresa: 'Padaria Sol',
  entregador: 'Joao Silva',
};

describe('numeroInternacional', () => {
  it.each([
    ['61987654321', '5561987654321'],
    ['6132345678', '556132345678'],
    ['(61) 98765-4321', '5561987654321'],
    ['5561987654321', '5561987654321'],
    ['55987654321', '5555987654321'],
  ])('converte %s em %s', (telefone, esperado) => {
    expect(numeroInternacional(telefone)).toBe(esperado);
  });

  it.each(['', '1234', '123456789012345'])(
    'recusa telefone invalido %p',
    (telefone) => {
      expect(numeroInternacional(telefone)).toBeNull();
    },
  );
});

describe('montarLinkWhatsapp', () => {
  it('monta o link wa.me com a mensagem codificada', () => {
    const link = montarLinkWhatsapp('61987654321', 'Olá, pedido #12 & cia');

    expect(link).toBe(
      'https://wa.me/5561987654321?text=Ol%C3%A1%2C%20pedido%20%2312%20%26%20cia',
    );
  });

  it('devolve null para telefone invalido', () => {
    expect(montarLinkWhatsapp('123', 'oi')).toBeNull();
  });
});

describe('mensagens iniciais', () => {
  it('a empresa cita so o pedido para o entregador', () => {
    expect(textoParaEntregador(DADOS)).toBe(
      'Olá, Joao Silva! Aqui é Padaria Sol, sobre a entrega do pedido #12.',
    );
  });

  it('o entregador cita so o pedido para a empresa', () => {
    expect(textoParaEstabelecimento(DADOS)).toBe(
      'Olá, Padaria Sol! Sou Joao Silva, entregador do pedido #12.',
    );
  });
});
