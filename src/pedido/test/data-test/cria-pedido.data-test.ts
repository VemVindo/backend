// import { CriaPedidoReqDto } from 'src/pedido/dto/cria-pedido.dto';

// interface MockCriaPedidoReqDto {
//   cenario: string;
//   dados: Partial<CriaPedidoReqDto> & {
//     [key: string]: any;
//   };
// }

// export const invalido: MockCriaPedidoReqDto[] = [
//   {
//     cenario: 'falha: id_pedido preenchido (deveria estar vazio pelo IsEmpty)',
//     dados: {
//       id_pedido: '123', // <-- Vai falhar pois @IsEmpty exige vazio
//       nome_recebedor: 'Ana Clara Silva',
//       telefone_recebedor: '119876543210',
//       cep: '01310100',
//       logradouro: 'Avenida Paulista',
//       numero: 1000,
//       complemento: 'Apto 42',
//       bairro: 'Bela Vista',
//       cidade: 'São Paulo',
//       uf: 'SP',
//       descricao: 'Entrega de documento urgente',
//       status: undefined,
//       data_criacao: undefined,
//       data_inicio_entrega: undefined,
//       data_finalizacao: undefined,
//       valor_entrega: 15.5,
//       idEmpresa: 101,
//       distancia: 4.2,
//       cpf_entregador: '',
//     },
//   },
//   {
//     cenario: 'falha: status preenchido (deveria estar vazio pelo IsEmpty)',
//     dados: {
//       id_pedido: undefined,
//       nome_recebedor: 'Carlos Eduardo Souza',
//       telefone_recebedor: '219712345678',
//       cep: '22041001',
//       logradouro: 'Avenida Atlântica',
//       numero: 500,
//       complemento: 'Bloco B',
//       bairro: 'Copacabana',
//       cidade: 'Rio de Janeiro',
//       uf: 'RJ',
//       descricao: 'Caixa com produtos de vestuário',
//       status: 'pendente', // <-- Vai falhar pois @IsEmpty exige vazio
//       data_criacao: undefined,
//       data_inicio_entrega: undefined,
//       data_finalizacao: undefined,
//       valor_entrega: 22.0,
//       idEmpresa: 102,
//       distancia: 7.8,
//       cpf_entregador: '12345678901',
//     },
//   },
//   {
//     cenario:
//       'falha: data_criacao preenchida (deveria estar vazia pelo IsEmpty)',
//     dados: {
//       id_pedido: undefined,
//       nome_recebedor: 'Mariana Oliveira Costa',
//       telefone_recebedor: '319888877770',
//       cep: '30130010',
//       logradouro: 'Rua da Bahia',
//       numero: 1200,
//       complemento: 'Sala 302',
//       bairro: 'Centro',
//       cidade: 'Belo Horizonte',
//       uf: 'MG',
//       descricao: 'Alimentos perecíveis',
//       status: undefined,
//       data_criacao: '2026-10-10T14:15:00Z', // <-- Vai falhar pois @IsEmpty exige vazio
//       data_inicio_entrega: undefined,
//       data_finalizacao: undefined,
//       valor_entrega: 12.5,
//       idEmpresa: 101,
//       distancia: 3.1,
//       cpf_entregador: '98765432109',
//     },
//   },
//   {
//     cenario:
//       'falha: data_inicio_entrega preenchida (deveria estar vazia pelo IsEmpty)',
//     dados: {
//       id_pedido: undefined,
//       nome_recebedor: 'Lucas Martins',
//       telefone_recebedor: '419991122330',
//       cep: '80010020',
//       logradouro: 'Rua XV de Novembro',
//       numero: 75,
//       complemento: '',
//       bairro: 'Centro',
//       cidade: 'Curitiba',
//       uf: 'PR',
//       descricao: 'Livros e materiais escolares',
//       status: undefined,
//       data_criacao: undefined,
//       data_inicio_entrega: '2026-10-11T12:00:00Z', // <-- Vai falhar pois @IsEmpty exige vazio
//       data_finalizacao: undefined,
//       valor_entrega: 18.0,
//       idEmpresa: 103,
//       distancia: 5.5,
//       cpf_entregador: '',
//     },
//   },
//   {
//     cenario:
//       'falha: data_finalizacao preenchida (deveria estar vazia pelo IsEmpty)',
//     dados: {
//       id_pedido: undefined,
//       nome_recebedor: 'Juliana Ferreira',
//       telefone_recebedor: '719811122330',
//       cep: '40140130',
//       logradouro: 'Avenida Oceânica',
//       numero: 2100,
//       complemento: 'Casa 3',
//       bairro: 'Ondina',
//       cidade: 'Salvador',
//       uf: 'BA',
//       descricao: 'Cosméticos',
//       status: undefined,
//       data_criacao: undefined,
//       data_inicio_entrega: undefined,
//       data_finalizacao: '2026-10-11T15:30:00Z', // <-- Vai falhar pois @IsEmpty exige vazio
//       valor_entrega: 25.0,
//       idEmpresa: 102,
//       distancia: 9.4,
//       cpf_entregador: '45678912300',
//     },
//   },
// ];

export const dataController = {
  valido: {
    stub_controller_criar: {
      id_pedido: 123,
      nome_recebedor: 'Ana Clara Silva',
      telefone_recebedor: '119876543210',
      cep: '01310100',
      logradouro: 'Avenida Paulista',
      numero: 1000,
      complemento: 'Apto 42',
      bairro: 'Bela Vista',
      cidade: 'São Paulo',
      uf: 'SP',
      descricao: 'Entrega de documento urgente',
      status: 'Pendente',
      data_criacao: '2026-10-10T14:15:00Z',
      data_inicio_entrega: undefined,
      data_finalizacao: undefined,
      valor_entrega: 15.5,
      idEmpresa: 101,
      distancia: 4.2,
      cpf_entregador: '',
    },
  },
};
