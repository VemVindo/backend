import {
  escolherResultado,
  RAIO_DO_CEP_M,
  ResultadoDoGeocoding,
} from './escolha-do-geocoding';

const GUARA = { bairro: 'Guara 1', uf: 'DF', cep: '71000-001' };

// 0,001 grau de latitude fica a uns 111 m.
const CENTRO = -15.82;
const PERTO = -15.821;
const LONGE = -15.83;

function resultado(
  dados: {
    lat?: number;
    bairro?: string;
    cep?: string;
    uf?: string;
    tipo?: string;
    parcial?: boolean;
    logradouro?: string;
    numero?: string;
  } = {},
): ResultadoDoGeocoding {
  const {
    lat = CENTRO,
    bairro = 'Guará',
    cep = '71000-001',
    uf = 'DF',
    tipo = 'ROOFTOP',
    parcial,
    logradouro = '',
    numero,
  } = dados;
  return {
    formatted_address: [logradouro, numero, bairro, `Brasília - ${uf}`, cep]
      .filter(Boolean)
      .join(', '),
    partial_match: parcial,
    geometry: { location: { lat, lng: -47.97 }, location_type: tipo },
    address_components: [
      { long_name: logradouro, types: ['route'] },
      { long_name: numero ?? '', types: ['street_number'] },
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

const centroDoCep = resultado({ tipo: 'APPROXIMATE' });

describe('escolherResultado', () => {
  describe('quando o Google conhece o CEP completo', () => {
    it('sem porta no texto, fica com o centro do CEP como aproximado', () => {
      const centroDeArea = resultado({
        lat: PERTO,
        tipo: 'GEOMETRIC_CENTER',
        parcial: true,
      });

      expect(escolherResultado([centroDoCep], [centroDeArea], GUARA)).toEqual({
        coordenada: { lat: CENTRO, lng: -47.97 },
        precisao: 'aproximado',
        enderecoEncontrado: 'Área do CEP: Guará, Brasília - DF, 71000-001',
      });
    });

    it('troca pelo ponto exato com o mesmo CEP perto do centro', () => {
      const porta = resultado({ lat: PERTO });

      expect(escolherResultado([centroDoCep], [porta], GUARA)).toEqual({
        coordenada: { lat: PERTO, lng: -47.97 },
        precisao: 'exato',
        enderecoEncontrado: 'Guará, Brasília - DF, 71000-001',
      });
    });

    it(`fica com o CEP quando a porta cai a mais de ${RAIO_DO_CEP_M} m, mesmo com o mesmo CEP`, () => {
      const longe = resultado({ lat: LONGE });

      expect(escolherResultado([centroDoCep], [longe], GUARA)).toMatchObject({
        coordenada: { lat: CENTRO },
        precisao: 'aproximado',
      });
    });

    it('ignora o ponto exato com outro CEP completo', () => {
      const outroConjunto = resultado({
        lat: LONGE,
        tipo: 'RANGE_INTERPOLATED',
        cep: '71000-099',
      });

      expect(
        escolherResultado([centroDoCep], [outroConjunto], GUARA),
      ).toMatchObject({ coordenada: { lat: CENTRO }, precisao: 'aproximado' });
    });

    it(`sem o CEP completo, so aceita a porta a ate ${RAIO_DO_CEP_M} m do centro`, () => {
      const perto = resultado({ lat: PERTO, cep: '71000' });
      const longe = resultado({ lat: LONGE, cep: '' });

      expect(
        escolherResultado([centroDoCep], [longe, perto], GUARA),
      ).toMatchObject({ coordenada: { lat: PERTO }, precisao: 'exato' });
      expect(escolherResultado([centroDoCep], [longe], GUARA)).toMatchObject({
        coordenada: { lat: CENTRO },
        precisao: 'aproximado',
      });
    });

    it('nao usa como centro o resultado do CEP que so confere a regiao', () => {
      const daRegiao = resultado({ tipo: 'APPROXIMATE', cep: '71000' });
      const porta = resultado({ lat: LONGE, cep: '71000' });

      expect(escolherResultado([daRegiao], [porta], GUARA)).toMatchObject({
        coordenada: { lat: LONGE },
        precisao: 'aproximado',
      });
    });
  });

  describe('quando o Google nao conhece o CEP completo', () => {
    it('marca exato so a porta com o CEP completo', () => {
      expect(escolherResultado([], [resultado()], GUARA)).toEqual({
        coordenada: { lat: CENTRO, lng: -47.97 },
        precisao: 'exato',
        enderecoEncontrado: 'Guará, Brasília - DF, 71000-001',
      });
      expect(
        escolherResultado([], [resultado({ cep: '71000-' })], GUARA)?.precisao,
      ).toBe('aproximado');
    });

    it('prefere o CEP completo a porta e bairro de outro trecho da regiao', () => {
      const daRegiao = resultado({ lat: LONGE, cep: '71000' });
      const doCep = resultado({
        lat: PERTO,
        tipo: 'GEOMETRIC_CENTER',
        bairro: 'Setor de Industria',
      });

      expect(
        escolherResultado([], [daRegiao, doCep], GUARA)?.coordenada.lat,
      ).toBe(PERTO);
    });

    it('no empate, vale a ordem do Google', () => {
      const primeiro = resultado({ lat: PERTO, tipo: 'APPROXIMATE' });
      const segundo = resultado({ lat: LONGE, tipo: 'APPROXIMATE' });

      expect(
        escolherResultado([], [primeiro, segundo], GUARA)?.coordenada.lat,
      ).toBe(PERTO);
    });

    it('descarta outro bairro com outro CEP, mesmo vindo primeiro', () => {
      const sudoeste = resultado({
        lat: -15.79,
        bairro: 'Sudoeste',
        cep: '70670-000',
      });

      expect(escolherResultado([], [sudoeste], GUARA)).toBeNull();
      expect(
        escolherResultado([], [sudoeste, resultado({ cep: '71000' })], GUARA),
      ).toMatchObject({ coordenada: { lat: CENTRO }, precisao: 'aproximado' });
    });

    it('descarta a quadra ou a area que nao confere o CEP completo', () => {
      const quadra = resultado({ cep: '71000', parcial: true });
      const area = resultado({ cep: '71000', tipo: 'GEOMETRIC_CENTER' });
      const semCep = resultado({ cep: '', tipo: 'APPROXIMATE' });

      expect(escolherResultado([], [quadra, area, semCep], GUARA)).toBeNull();
    });

    it('descarta outro CEP mesmo com o bairro certo', () => {
      expect(
        escolherResultado([], [resultado({ cep: '71999-000' })], GUARA),
      ).toBeNull();
      expect(
        escolherResultado([], [resultado({ cep: '72000' })], GUARA),
      ).toBeNull();
    });

    it('sem CEP no resultado, aceita so o bairro certo', () => {
      expect(
        escolherResultado([], [resultado({ cep: '' })], GUARA)?.precisao,
      ).toBe('aproximado');
      expect(
        escolherResultado(
          [],
          [resultado({ cep: '', bairro: 'Taguatinga' })],
          GUARA,
        ),
      ).toBeNull();
    });

    it('nao confia em bairro so com palavras genericas', () => {
      const semNome = { ...GUARA, bairro: 'Setor 1' };
      expect(
        escolherResultado([], [resultado({ cep: '' })], semNome),
      ).toBeNull();
    });
  });

  it('descarta resultado de outro estado', () => {
    expect(
      escolherResultado(
        [resultado({ uf: 'GO' })],
        [resultado({ uf: 'GO' })],
        GUARA,
      ),
    ).toBeNull();
  });

  it('prefere a quadra e o número informados a outro ponto do mesmo CEP e bairro', () => {
    const endereco = {
      ...GUARA,
      logradouro: 'SQN 210 Bloco K',
      numero: 304,
    };
    const outraQuadra = resultado({
      lat: LONGE,
      logradouro: 'SQN 211 Bloco K',
      numero: '304',
    });
    const enderecoCorreto = resultado({
      lat: PERTO,
      logradouro: 'SQN 210 Bloco K',
      numero: '304',
    });

    expect(
      escolherResultado([], [outraQuadra, enderecoCorreto], endereco),
    ).toMatchObject({
      coordenada: { lat: PERTO },
      precisao: 'exato',
    });
    expect(escolherResultado([], [outraQuadra], endereco)).toBeNull();
  });

  it('descarta o número diferente mesmo quando a quadra e o CEP conferem', () => {
    const endereco = {
      ...GUARA,
      logradouro: 'SQN 210 Bloco K',
      numero: 304,
    };
    const outroNumero = resultado({
      logradouro: 'SQN 210 Bloco K',
      numero: '305',
    });

    expect(escolherResultado([], [outroNumero], endereco)).toBeNull();
  });

  it('mantem aproximado quando o ponto exato nao informa rua nem numero', () => {
    const endereco = {
      ...GUARA,
      logradouro: 'SQN 210 Bloco K',
      numero: 304,
    };
    const semRuaNemNumero: ResultadoDoGeocoding = {
      formatted_address: 'Guará, Brasília - DF, 71000-001',
      geometry: {
        location: { lat: CENTRO, lng: -47.97 },
        location_type: 'ROOFTOP',
      },
      address_components: [
        { long_name: 'Guará', types: ['sublocality'] },
        {
          long_name: 'Distrito Federal',
          short_name: 'DF',
          types: ['administrative_area_level_1'],
        },
        { long_name: '71000-001', types: ['postal_code'] },
      ],
    };
    const outroPontoSemRuaNemNumero: ResultadoDoGeocoding = {
      ...semRuaNemNumero,
      geometry: {
        location: { lat: PERTO, lng: -47.97 },
        location_type: 'ROOFTOP',
      },
    };

    expect(
      escolherResultado(
        [],
        [semRuaNemNumero, outroPontoSemRuaNemNumero],
        endereco,
      ),
    ).toMatchObject({ precisao: 'aproximado' });
  });

  it('ignora resultado sem coordenada ou sem componentes', () => {
    expect(escolherResultado([{ geometry: {} }], [], GUARA)).toBeNull();
    expect(
      escolherResultado(
        [],
        [{ geometry: { location: { lat: -15, lng: -47 } } }],
        GUARA,
      ),
    ).toBeNull();
  });

  it('aceita componentes e campos que o Google omite', () => {
    const incompleto: ResultadoDoGeocoding = {
      geometry: { location: { lat: CENTRO, lng: -47.97 } },
      address_components: [
        { types: ['neighborhood'] },
        { long_name: 'Guará', types: ['sublocality'] },
        { long_name: '71000-001', types: ['postal_code'] },
      ],
    };

    expect(escolherResultado([incompleto], [], GUARA)).toEqual({
      coordenada: { lat: CENTRO, lng: -47.97 },
      precisao: 'aproximado',
      enderecoEncontrado: null,
    });
  });
});
