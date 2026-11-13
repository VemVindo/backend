import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { TipoVeiculo } from '../../common/enums/tipo-veiculo.enum';
import { EditarPerfilDto } from '../dto/editar-perfil.dto';

function validar(dados: object) {
  const dto = plainToInstance(EditarPerfilDto, dados);
  return { dto, campos: validateSync(dto).map((e) => e.property) };
}

describe('EditarPerfilDto', () => {
  it('aceita o corpo vazio, porque todos os campos sao opcionais', () => {
    expect(validar({}).campos).toEqual([]);
  });

  it('aceita os campos validos e normaliza nome e placa', () => {
    const { dto, campos } = validar({
      nome: '  Entregador Teste  ',
      telefone: '61900000000',
      tipoVeiculo: TipoVeiculo.CARRO,
      placa: 'abc-1d23',
    });

    expect(campos).toEqual([]);
    expect(dto.nome).toBe('Entregador Teste');
    expect(dto.placa).toBe('ABC1D23');
  });

  it('recusa nome vazio, longo demais ou nulo', () => {
    expect(validar({ nome: '   ' }).campos).toEqual(['nome']);
    expect(validar({ nome: 'a'.repeat(121) }).campos).toEqual(['nome']);
    expect(validar({ nome: null }).campos).toEqual(['nome']);
  });

  it('recusa telefone com mascara ou sem DDD', () => {
    expect(validar({ telefone: '(61) 90000-0000' }).campos).toEqual([
      'telefone',
    ]);
    expect(validar({ telefone: '900000000' }).campos).toEqual(['telefone']);
  });

  it('recusa tipo de veiculo desconhecido', () => {
    expect(validar({ tipoVeiculo: 'PATINETE' }).campos).toEqual([
      'tipoVeiculo',
    ]);
  });

  it('recusa placa fora do padrao, nula ou que nao e texto', () => {
    expect(validar({ placa: 'AB12345' }).campos).toEqual(['placa']);
    expect(validar({ placa: null }).campos).toEqual(['placa']);

    const numerica = validar({ placa: 1234 });
    expect(numerica.dto.placa).toBe(1234);
    expect(numerica.campos).toEqual(['placa']);
  });
});
