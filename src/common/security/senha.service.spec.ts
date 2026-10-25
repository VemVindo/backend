import { hashSync } from 'bcryptjs';
import { SenhaService } from './senha.service';

describe('SenhaService', () => {
  const servico = new SenhaService();

  it('confere a senha contra o proprio hash', async () => {
    const hash = await servico.hash('senha-de-teste');
    await expect(servico.verificar('senha-de-teste', hash)).resolves.toBe(true);
    await expect(servico.verificar('outra-senha', hash)).resolves.toBe(false);
  });

  it('compara a senha com um hash existente', async () => {
    const hash = await servico.hash('senha-de-teste');
    await expect(servico.comparar('senha-de-teste', hash)).resolves.toBe(true);
    await expect(servico.comparar('outra-senha', hash)).resolves.toBe(false);
  });

  it('retorna false sem hash, passando pelo bcrypt mesmo assim', async () => {
    // Custo baixo so aqui: o caso mede o caminho, nao a forca do hash.
    const gerarHash = jest
      .spyOn(servico, 'hash')
      .mockResolvedValue(hashSync('aleatoria', 4));
    await expect(servico.verificar('qualquer', null)).resolves.toBe(false);
    await expect(servico.verificar('qualquer', undefined)).resolves.toBe(false);
    expect(gerarHash).toHaveBeenCalledTimes(1);
  });
});
