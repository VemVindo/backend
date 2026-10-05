import { registerDecorator, ValidationOptions } from 'class-validator';

const PESOS_PRIMEIRO = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_SEGUNDO = [6, ...PESOS_PRIMEIRO];

const DOZE_ALFANUMERICOS_E_DOIS_DIGITOS = /^[A-Z0-9]{12}\d{2}$/;
const MESMO_CARACTERE_REPETIDO = /^(.)\1{13}$/;
const CODIGO_ASCII_DO_ZERO = 48;

export function cnpjValido(cnpj: unknown): boolean {
  if (
    typeof cnpj !== 'string' ||
    !DOZE_ALFANUMERICOS_E_DOIS_DIGITOS.test(cnpj)
  ) {
    return false;
  }
  if (MESMO_CARACTERE_REPETIDO.test(cnpj)) {
    return false;
  }

  const valores = cnpj
    .split('')
    .map((c) => c.charCodeAt(0) - CODIGO_ASCII_DO_ZERO);
  const verificador = (pesos: number[]) => {
    const soma = pesos.reduce((acc, peso, i) => acc + valores[i] * peso, 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  return (
    verificador(PESOS_PRIMEIRO) === valores[12] &&
    verificador(PESOS_SEGUNDO) === valores[13]
  );
}

export function IsCnpj(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isCnpj',
      target: object.constructor,
      propertyName,
      options: {
        message: 'CNPJ invalido: informe os 14 caracteres, sem pontuacao',
        ...validationOptions,
      },
      validator: {
        validate: cnpjValido,
      },
    });
  };
}
