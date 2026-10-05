import { Transform } from 'class-transformer';

function seTexto(transformar: (valor: string) => string) {
  return Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? transformar(value) : value,
  );
}

export const Trim = () => seTexto((valor) => valor.trim());

export const NormalizarEmail = () =>
  seTexto((valor) => valor.trim().toLowerCase());

export const Maiusculo = () => seTexto((valor) => valor.trim().toUpperCase());
