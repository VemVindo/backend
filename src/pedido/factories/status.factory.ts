export class StatusFactory {
  static criar(cpf_entregador: string | undefined): string {
    if (cpf_entregador) return 'Em andamento';
    else return 'Pendente';
  }
}
