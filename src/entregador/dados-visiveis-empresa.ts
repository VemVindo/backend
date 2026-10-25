import { Entregador } from '../generated/prisma/client';

export function dadosVisiveisParaEmpresa(entregador: Entregador) {
  return {
    nome: entregador.nome,
    cpf: entregador.cpf,
    telefone: entregador.telefone,
    tipoVeiculo: entregador.tipo_veiculo,
    placa: entregador.placa,
    disponivel: entregador.disponivel,
  };
}
