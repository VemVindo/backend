import {
  escolherResultado,
  ResultadoDoGeocoding,
} from './escolha-do-geocoding';

const GUARA = { bairro: 'Guara 1', uf: 'DF', cep: '71000-000' };

function resultado(
  dados: {
    lat?: number;
    bairro?: string;
    cep?: string;
    uf?: string;
    tipo?: string;
    parcial?: boolean;
  } = {},
): ResultadoDoGeocoding {
  const {
    lat = -15.82,
    bairro = 'Guará',
    cep = '71000-000',
    uf = 'DF',
    tipo = 'ROOFTOP',
    parcial,
  } = dados;
  return {
    formatted_address: `${bairro}, Brasília - ${uf}`,
    partial_match: parcial,
    geometry: { location: { lat, lng: -47.97 }, location_type: tipo },
    address_components: [
      { long_name: 'Rua do Guará', types: ['route'] },
      { long_name: bairro, types: ['sublocality_level_1', 'sublocality'] },
      { long_name: 'Brasília', types: ['administrative_area_level_2'] },
      {
        long_name: 'Distrito Federal',
        short_name: uf,
        types: ['administrative_area_level_1'],
      },
      ...(cep ? [{ long_name: cep, types: ['postal_code'] }] : []),
    ],
  };
}

describe('escolherResultado', () => {
  it('aceita o bairro escrito de outro jeito e marca a porta como exata', () => {
    expect(escolherResultado([resultado()], GUARA)).toEqual({
      coordenada: { lat: -15.82, lng: -47.97 },
      precisao: 'exato',
      enderecoEncontrado: 'Guará, Brasília - DF',
    });
  });

  it('descarta outro bairro com outro CEP, mesmo vindo primeiro', () => {
    const sudoeste = resultado({
      lat: -15.79,
      bairro: 'Sudoeste',
      cep: '70670-000',
    });

    expect(escolherResultado([sudoeste], GUARA)).toBeNull();
    expect(
      escolherResultado([sudoeste, resultado({ tipo: 'APPROXIMATE' })], GUARA),
    ).toMatchObject({ coordenada: { lat: -15.82 }, precisao: 'aproximado' });
  });

  it('aceita o CEP certo com o bairro com outro nome no Google', () => {
    expect(
      escolherResultado([resultado({ bairro: 'Setor de Industria' })], GUARA),
    ).not.toBeNull();
  });

  it('aceita o bairro certo quando o Google nao informa o CEP', () => {
    expect(escolherResultado([resultado({ cep: '' })], GUARA)).not.toBeNull();
    expect(
      escolherResultado([resultado({ cep: '', bairro: 'Taguatinga' })], GUARA),
    ).toBeNull();
  });

  it('descarta resultado de outro estado', () => {
    expect(escolherResultado([resultado({ uf: 'GO' })], GUARA)).toBeNull();
  });

  it('nao confia em bairro so com palavras genericas', () => {
    const semNome = { ...GUARA, bairro: 'Setor 1', cep: '72000-000' };
    expect(escolherResultado([resultado()], semNome)).toBeNull();
  });

  it('trata o resultado parcial e o centro de area como aproximados', () => {
    expect(
      escolherResultado([resultado({ parcial: true })], GUARA)?.precisao,
    ).toBe('aproximado');
    expect(
      escolherResultado([resultado({ tipo: 'GEOMETRIC_CENTER' })], GUARA)
        ?.precisao,
    ).toBe('aproximado');
  });

  it('prefere o que mais confere e, no empate, a ordem do Google', () => {
    const soBairro = resultado({ lat: -15.1, cep: '71999-000' });
    const cepEBairro = resultado({ lat: -15.2 });
    const outroIgual = resultado({ lat: -15.3 });

    expect(
      escolherResultado([soBairro, cepEBairro, outroIgual], GUARA)?.coordenada
        .lat,
    ).toBe(-15.2);
  });

  it('ignora resultado sem coordenada ou sem componentes', () => {
    expect(escolherResultado([{ geometry: {} }], GUARA)).toBeNull();
    expect(
      escolherResultado(
        [{ geometry: { location: { lat: -15, lng: -47 } } }],
        GUARA,
      ),
    ).toBeNull();
  });

  it('aceita componentes e campos que o Google omite', () => {
    const incompleto: ResultadoDoGeocoding = {
      geometry: { location: { lat: -15.82, lng: -47.97 } },
      address_components: [
        { types: ['neighborhood'] },
        { long_name: 'Guará', types: ['sublocality'] },
        { long_name: '71000-000', types: ['postal_code'] },
      ],
    };

    expect(escolherResultado([incompleto], GUARA)).toEqual({
      coordenada: { lat: -15.82, lng: -47.97 },
      precisao: 'aproximado',
      enderecoEncontrado: null,
    });
  });
});
