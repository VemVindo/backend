import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import {
  CredencialIntegracaoGuard,
  RequisicaoIntegracao,
} from './credencial-integracao.guard';
import { CredencialService } from './credencial.service';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

function contexto(headers: Record<string, unknown>) {
  const requisicao = { headers } as unknown as RequisicaoIntegracao;
  const ctx = {
    switchToHttp: () => ({ getRequest: () => requisicao }),
  } as unknown as ExecutionContext;
  return { ctx, requisicao };
}

describe('CredencialIntegracaoGuard', () => {
  const autenticar = jest.fn();
  const guard = new CredencialIntegracaoGuard({
    autenticar,
  } as unknown as CredencialService);

  afterEach(() => autenticar.mockReset());

  it('recusa requisicao sem o cabecalho X-Api-Key', async () => {
    const { ctx } = contexto({});

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    expect(autenticar).not.toHaveBeenCalled();
  });

  it('recusa chave invalida ou revogada', async () => {
    autenticar.mockResolvedValue(null);
    const { ctx } = contexto({ 'x-api-key': 'vv_invalida' });

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('libera e anexa a empresa da chave a requisicao', async () => {
    autenticar.mockResolvedValue({ empresaId: 2, credencialId: 10 });
    const { ctx, requisicao } = contexto({ 'x-api-key': 'vv_valida' });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(requisicao.integracao).toEqual({ empresaId: 2, credencialId: 10 });
  });
});
