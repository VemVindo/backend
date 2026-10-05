import { registerDecorator, ValidationOptions } from 'class-validator';

const ONZE_DIGITOS = /^\d{11}$/;
const MESMO_DIGITO_REPETIDO = /^(\d)\1{10}$/;

export function cpfValido(cpf: unknown): boolean {
  if (typeof cpf !== 'string' || !ONZE_DIGITOS.test(cpf)) {
    return false;
  }
  if (MESMO_DIGITO_REPETIDO.test(cpf)) {
    return false;
  }

  const digitos = cpf.split('').map(Number);
  const verificador = (quantidade: number) => {
    let soma = 0;
    for (let i = 0; i < quantidade; i++) {
      soma += digitos[i] * (quantidade + 1 - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return verificador(9) === digitos[9] && verificador(10) === digitos[10];
}

export function IsCpf(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isCpf',
      target: object.constructor,
      propertyName,
      options: {
        message: 'CPF invalido: informe os 11 digitos, sem pontos ou traco',
        ...validationOptions,
      },
      validator: {
        validate: cpfValido,
      },
    });
  };
}
