import { SenhaService } from './senha.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('confere a senha contra o proprio hash', async () => {
    const hash = await service.hash('senha-de-teste');
    await expect(service.verificar('senha-de-teste', hash)).resolves.toBe(true);
    await expect(service.verificar('outra-senha', hash)).resolves.toBe(false);
  });

  it('retorna false sem hash, passando pelo bcrypt mesmo assim', async () => {
    const gerarHash = jest.spyOn(service, 'hash');
    await expect(service.verificar('qualquer', null)).resolves.toBe(false);
    await expect(service.verificar('qualquer', undefined)).resolves.toBe(false);
    expect(gerarHash).toHaveBeenCalledTimes(1);
  });
});
