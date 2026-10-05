import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { TipoVeiculo } from '../../common/enums/tipo-veiculo.enum';
import { CadastrarEntregadorDto } from './cadastrar-entregador.dto';

const base = {
  nome: 'Entregador Teste',
  cpf: '52998224725',
  telefone: '61900000000',
};

function erros(dados: object) {
  const dto = plainToInstance(CadastrarEntregadorDto, { ...base, ...dados });
  return { dto, campos: validateSync(dto).map((e) => e.property) };
}

describe('CadastrarEntregadorDto', () => {
  it('exige placa para moto e carro', () => {
    expect(erros({ tipoVeiculo: TipoVeiculo.MOTO }).campos).toEqual(['placa']);
    expect(erros({ tipoVeiculo: TipoVeiculo.CARRO }).campos).toEqual(['placa']);
  });

  it('dispensa placa para bicicleta', () => {
    expect(erros({ tipoVeiculo: TipoVeiculo.BICICLETA }).campos).toEqual([]);
  });

  it('aceita placa antiga e Mercosul, normalizando caixa e traco', () => {
    const antiga = erros({
      tipoVeiculo: TipoVeiculo.MOTO,
      placa: 'abc-1234',
    });
    expect(antiga.campos).toEqual([]);
    expect(antiga.dto.placa).toBe('ABC1234');

    const mercosul = erros({
      tipoVeiculo: TipoVeiculo.CARRO,
      placa: 'ABC1D23',
    });
    expect(mercosul.campos).toEqual([]);
  });

  it('recusa placa fora do padrao', () => {
    expect(
      erros({ tipoVeiculo: TipoVeiculo.MOTO, placa: 'AB12345' }).campos,
    ).toEqual(['placa']);
  });

  it('recusa telefone com mascara e nome so com espacos', () => {
    expect(
      erros({
        tipoVeiculo: TipoVeiculo.BICICLETA,
        telefone: '(61) 90000-0000',
        nome: '   ',
      }).campos.sort(),
    ).toEqual(['nome', 'telefone']);
  });
});
