import { VALIDADE_SENHA_TEMPORARIA_HORAS } from './senha.constants';

export function expiracaoSenhaTemporaria(agora = new Date()): Date {
  return new Date(
    agora.getTime() + VALIDADE_SENHA_TEMPORARIA_HORAS * 60 * 60 * 1000,
  );
}

// Sem prazo gravado conta como expirada: na duvida, o acesso e recusado.
export function senhaTemporariaExpirada(
  expiraEm: Date | null,
  agora = new Date(),
): boolean {
  return !expiraEm || expiraEm <= agora;
}
