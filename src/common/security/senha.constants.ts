export const TAMANHO_MINIMO_SENHA = 8;
export const TAMANHO_MAXIMO_SENHA_BCRYPT = 72;

// So ASCII imprimivel: 1 byte por caractere, entao 72 caracteres cabem nos
// 72 bytes que o bcrypt considera.
export const CARACTERES_PERMITIDOS_SENHA = /^[\x21-\x7E]*$/;
export const MENSAGEM_CARACTERES_SENHA =
  'senha aceita apenas letras sem acento, numeros e simbolos do teclado, sem espacos';

// Prazo para o entregador fazer o primeiro acesso. Depois disso, so a empresa
// que o cadastrou gera outra senha temporaria.
export const VALIDADE_SENHA_TEMPORARIA_HORAS = 48;
