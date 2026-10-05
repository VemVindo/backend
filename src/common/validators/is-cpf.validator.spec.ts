import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { cpfValido, IsCpf } from './is-cpf.validator';

const CPF_FICTICIO = '52998224725';

describe('cpfValido', () => {
  it('aceita CPF com digitos verificadores corretos', () => {
    expect(cpfValido(CPF_FICTICIO)).toBe(true);
    expect(cpfValido('11144477735')).toBe(true);
  });

  it('recusa CPF com pontos e traco', () => {
    expect(cpfValido('529.982.247-25')).toBe(false);
  });

  it('recusa digito verificador errado', () => {
    expect(cpfValido('52998224724')).toBe(false);
    expect(cpfValido('52998224715')).toBe(false);
  });

  it('recusa sequencias repetidas', () => {
    expect(cpfValido('00000000000')).toBe(false);
    expect(cpfValido('11111111111')).toBe(false);
  });

  it('recusa tamanho errado e tipos que nao sao texto', () => {
    expect(cpfValido('5299822472')).toBe(false);
    expect(cpfValido('529982247250')).toBe(false);
    expect(cpfValido(52998224725)).toBe(false);
    expect(cpfValido(undefined)).toBe(false);
  });
});

describe('@IsCpf', () => {
  class Dto {
    @IsCpf()
    cpf: string;
  }

  it('gera erro de validacao para CPF formatado', () => {
    const erros = validateSync(plainToInstance(Dto, { cpf: '529.982.247-25' }));
    expect(erros).toHaveLength(1);
    expect(erros[0].constraints).toHaveProperty('isCpf');
  });

  it('passa sem erros com CPF valido', () => {
    expect(
      validateSync(plainToInstance(Dto, { cpf: CPF_FICTICIO })),
    ).toHaveLength(0);
  });
});
