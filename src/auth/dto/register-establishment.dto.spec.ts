import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { RegisterEstablishmentDto } from './register-establishment.dto';

const base = {
  nomeFantasia: 'Loja Teste',
  email: 'loja@example.com',
  telefone: '61900000000',
  cnpj: '11222333000181',
  razaoSocial: 'Loja Teste Ltda',
  cep: '70000000',
  logradouro: 'Rua Teste',
  numero: 10,
  bairro: 'Centro',
  cidade: 'Brasilia',
  uf: 'DF',
  senha: 'senha-segura',
};

function validar(dados: object) {
  const dto = plainToInstance(RegisterEstablishmentDto, { ...base, ...dados });
  return { dto, campos: validateSync(dto).map((e) => e.property) };
}

describe('RegisterEstablishmentDto', () => {
  it('aceita um cadastro valido', () => {
    expect(validar({}).campos).toEqual([]);
  });

  it('normaliza e-mail, UF e CNPJ alfanumerico', () => {
    const { dto, campos } = validar({
      email: '  Loja@Example.COM ',
      uf: 'df',
      cnpj: '12abc34501de35',
    });
    expect(campos).toEqual([]);
    expect(dto.email).toBe('loja@example.com');
    expect(dto.uf).toBe('DF');
    expect(dto.cnpj).toBe('12ABC34501DE35');
  });

  it('recusa CNPJ, CEP e UF invalidos', () => {
    expect(
      validar({ cnpj: '11222333000182', cep: '70000-000', uf: 'XX' }).campos,
    ).toEqual(['cnpj', 'cep', 'uf']);
  });

  it('recusa senha acima do limite do bcrypt', () => {
    expect(validar({ senha: 'a'.repeat(73) }).campos).toEqual(['senha']);
  });
});
