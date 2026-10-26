import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CriarPedidoDto } from './criar-pedido.dto';

const pedidoValido = {
  nome_recebedor: 'Carla Menezes',
  telefone_recebedor: '61920008888',
  cep: '70000000',
  logradouro: 'Rua das Flores',
  numero: 10,
  bairro: 'Centro',
  cidade: 'Brasilia',
  uf: 'DF',
  descricao: 'Pedido de teste',
  tipo_veiculo: 'DRIVE',
};

function camposComErro(dados: Record<string, unknown>): string[] {
  return validateSync(plainToInstance(CriarPedidoDto, dados), {
    whitelist: true,
    forbidNonWhitelisted: true,
  }).map((erro) => erro.property);
}

describe('CriarPedidoDto', () => {
  it.each(['DRIVE', 'BICYCLE'])('aceita tipo_veiculo %s', (tipoVeiculo) => {
    expect(
      camposComErro({ ...pedidoValido, tipo_veiculo: tipoVeiculo }),
    ).toEqual([]);
  });

  it.each([undefined, '', 'CARRO', 'WALK'])(
    'recusa tipo_veiculo invalido: %p',
    (tipoVeiculo) => {
      expect(
        camposComErro({ ...pedidoValido, tipo_veiculo: tipoVeiculo }),
      ).toEqual(['tipo_veiculo']);
    },
  );

  it.each(['distancia', 'valor_entrega'])(
    'recusa %s vindo do cliente, pois e calculado na criacao',
    (campo) => {
      expect(camposComErro({ ...pedidoValido, [campo]: 1000 })).toEqual([
        campo,
      ]);
    },
  );
});
