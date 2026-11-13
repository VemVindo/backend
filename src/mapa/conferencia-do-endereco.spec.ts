import { conferirLogradouro, conferirNumero } from './conferencia-do-endereco';
import type { ResultadoDoGeocoding } from './escolha-do-geocoding';

describe('conferirLogradouro', () => {
  it('considera conferido quando o logradouro nao foi informado', () => {
    expect(conferirLogradouro({}, undefined)).toBe('confere');
    expect(conferirLogradouro({}, '')).toBe('confere');
  });

  it('considera conferido quando o logradouro tem apenas palavras genericas', () => {
    expect(conferirLogradouro({}, 'Rua Quadra')).toBe('confere');
  });

  it('usa o endereco formatado quando os componentes nao informam o logradouro', () => {
    const resultado: ResultadoDoGeocoding = {
      formatted_address: 'Avenida Brasil, Brasilia',
      address_components: [
        { long_name: 'Centro', types: ['sublocality'] },
        { types: ['route'] },
      ],
    };

    expect(conferirLogradouro(resultado, 'Avenida Brasil')).toBe('confere');
  });

  it('considera ausente quando nao ha componentes nem endereco formatado', () => {
    expect(conferirLogradouro({}, 'Avenida Brasil')).toBe('ausente');
  });

  it('considera diferente quando so parte do logradouro confere', () => {
    const resultado: ResultadoDoGeocoding = {
      address_components: [{ long_name: 'Brasil', types: ['route'] }],
    };

    expect(conferirLogradouro(resultado, 'Brasil Central')).toBe('diferente');
  });

  it('considera diferente quando ha outro logradouro, sem palavras em comum', () => {
    const resultado: ResultadoDoGeocoding = {
      address_components: [{ long_name: 'Palmeiras', types: ['route'] }],
    };

    expect(conferirLogradouro(resultado, 'Avenida Brasil')).toBe('diferente');
  });
});

describe('conferirNumero', () => {
  it('considera conferido quando o numero nao foi informado', () => {
    expect(conferirNumero({}, undefined)).toBe('confere');
  });

  it('considera ausente quando o componente do numero nao esta disponivel', () => {
    expect(conferirNumero({}, 304)).toBe('ausente');
    expect(
      conferirNumero({ address_components: [{ long_name: '304' }] }, 304),
    ).toBe('ausente');
    expect(
      conferirNumero(
        {
          address_components: [{ long_name: 'Rua Brasil', types: ['route'] }],
        },
        304,
      ),
    ).toBe('ausente');
  });

  it('compara apenas os digitos do numero encontrado', () => {
    const resultado: ResultadoDoGeocoding = {
      address_components: [{ long_name: '304-A', types: ['street_number'] }],
    };

    expect(conferirNumero(resultado, 304)).toBe('confere');
    expect(conferirNumero(resultado, 305)).toBe('diferente');
  });
});
