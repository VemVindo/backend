import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { cnpjValido, IsCnpj } from './is-cnpj.validator';

const CNPJ_FICTICIO = '11222333000181';
const CNPJ_ALFANUMERICO_FICTICIO = '12ABC34501DE35';

describe('cnpjValido', () => {
  it('aceita CNPJ numerico com digitos verificadores corretos', () => {
    expect(cnpjValido(CNPJ_FICTICIO)).toBe(true);
  });

  it('aceita CNPJ alfanumerico', () => {
    expect(cnpjValido(CNPJ_ALFANUMERICO_FICTICIO)).toBe(true);
  });

  it('recusa CNPJ com pontuacao', () => {
    expect(cnpjValido('11.222.333/0001-81')).toBe(false);
  });

  it('recusa digito verificador errado', () => {
    expect(cnpjValido('11222333000182')).toBe(false);
    expect(cnpjValido('11222333000191')).toBe(false);
    expect(cnpjValido('12ABC34501DE36')).toBe(false);
  });

  it('recusa letras minusculas e letras nos digitos verificadores', () => {
    expect(cnpjValido('12abc34501de35')).toBe(false);
    expect(cnpjValido('112223330001AB')).toBe(false);
  });

  it('recusa sequencias repetidas', () => {
    expect(cnpjValido('00000000000000')).toBe(false);
    expect(cnpjValido('11111111111111')).toBe(false);
  });

  it('recusa tamanho errado e tipos que nao sao texto', () => {
    expect(cnpjValido('1122233300018')).toBe(false);
    expect(cnpjValido('112223330001810')).toBe(false);
    expect(cnpjValido(11222333000181)).toBe(false);
    expect(cnpjValido(undefined)).toBe(false);
  });
});

describe('@IsCnpj', () => {
  class Dto {
    @IsCnpj()
    cnpj: string;
  }

  it('gera erro de validacao para CNPJ formatado', () => {
    const erros = validateSync(
      plainToInstance(Dto, { cnpj: '11.222.333/0001-81' }),
    );
    expect(erros).toHaveLength(1);
    expect(erros[0].constraints).toHaveProperty('isCnpj');
  });

  it('passa sem erros com CNPJ valido', () => {
    expect(
      validateSync(plainToInstance(Dto, { cnpj: CNPJ_FICTICIO })),
    ).toHaveLength(0);
  });
});
