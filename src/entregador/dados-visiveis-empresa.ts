import { Entregador } from '../generated/prisma/client';

// A frota da empresa e a tela de transparencia do entregador usam este mesmo
// objeto. Rota da empresa que leia dados do entregador deve exigir vinculo ATIVO.
export function dadosVisiveisParaEmpresa(entregador: Entregador) {
  return {
    nome: entregador.nome,
    cpf: entregador.cpf,
    tipoVeiculo: entregador.tipo_veiculo,
    placa: entregador.placa,
    disponivel: entregador.disponivel,
  };
}
