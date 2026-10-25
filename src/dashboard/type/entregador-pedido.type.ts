import { Pedido } from 'src/generated/prisma';

export type EntregadorEPedidos = {
  pedidos: Partial<Pedido>[];
  cpf: string;
  nome: string;
  disponivel: boolean;
  telefone: string;
  tipo_veiculo: string;
  placa: string | null;
  senha: string;
  senha_temporaria: boolean;
  ciencia_dados_em: Date | null;
  senha_temporaria_expira_em: Date | null;
  sessao_versao: number;
};
