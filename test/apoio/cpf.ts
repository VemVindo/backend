export function gerarCpfValido(): string {
  const digitos = Array.from({ length: 9 }, () =>
    Math.floor(Math.random() * 10),
  );
  for (const tamanho of [9, 10]) {
    const soma = digitos
      .slice(0, tamanho)
      .reduce(
        (total, digito, posicao) => total + digito * (tamanho + 1 - posicao),
        0,
      );
    const resto = (soma * 10) % 11;
    digitos.push(resto === 10 ? 0 : resto);
  }
  return digitos.join('');
}
