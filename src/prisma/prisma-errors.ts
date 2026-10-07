const CODIGO_VIOLACAO_UNICIDADE = 'P2002';

export function violouUnicidade(erro: unknown): boolean {
  return (
    typeof erro === 'object' &&
    erro !== null &&
    'code' in erro &&
    erro.code === CODIGO_VIOLACAO_UNICIDADE
  );
}
