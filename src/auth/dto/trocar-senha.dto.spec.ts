import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { TrocarSenhaDto } from './trocar-senha.dto';

function campos(dados: object) {
  const dto = plainToInstance(TrocarSenhaDto, {
    senhaAtual: 'Temp@2026',
    novaSenha: 'NovaSenha@1',
    ...dados,
  });
  return validateSync(dto).map((e) => e.property);
}

describe('TrocarSenhaDto', () => {
  it('aceita a troca com ou sem a ciencia dos dados', () => {
    expect(campos({})).toEqual([]);
    expect(campos({ cienteDadosCompartilhados: true })).toEqual([]);
  });

  it('recusa nova senha acima de 72 caracteres ou fora do ASCII', () => {
    expect(campos({ novaSenha: 'a'.repeat(73) })).toEqual(['novaSenha']);
    expect(campos({ novaSenha: 'senhacomacentuação' })).toEqual(['novaSenha']);
  });

  it('recusa ciencia que nao e booleana', () => {
    expect(campos({ cienteDadosCompartilhados: 'sim' })).toEqual([
      'cienteDadosCompartilhados',
    ]);
  });
});
