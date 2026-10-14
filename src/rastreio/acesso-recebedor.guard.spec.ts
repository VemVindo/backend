import {
  ExecutionContext,
  GoneException,
  NotFoundException,
} from '@nestjs/common';
import {
  AcessoRecebedorGuard,
  RequisicaoRecebedor,
} from './acesso-recebedor.guard';
import { RastreioService } from './rastreio.service';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

function contexto(params: Record<string, unknown>) {
  const requisicao = { params } as unknown as RequisicaoRecebedor;
  const ctx = {
    switchToHttp: () => ({ getRequest: () => requisicao }),
  } as unknown as ExecutionContext;
  return { ctx, requisicao };
}

describe('AcessoRecebedorGuard', () => {
  const autenticar = jest.fn();
  const guard = new AcessoRecebedorGuard({
    autenticar,
  } as unknown as RastreioService);

  afterEach(() => autenticar.mockReset());

  it('responde 404 para link invalido', async () => {
    autenticar.mockResolvedValue({ situacao: 'invalido' });
    const { ctx } = contexto({ token: 'qualquer' });

    await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
  });

  it('responde 410 para entrega encerrada', async () => {
    autenticar.mockResolvedValue({ situacao: 'encerrado' });
    const { ctx } = contexto({ token: 'qualquer' });

    await expect(guard.canActivate(ctx)).rejects.toThrow(GoneException);
  });

  it('trata rota sem :token como link invalido', async () => {
    autenticar.mockResolvedValue({ situacao: 'invalido' });
    const { ctx } = contexto({});

    await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
    expect(autenticar).toHaveBeenCalledWith('');
  });

  it('libera e anexa o acesso a requisicao', async () => {
    const acesso = { idPedido: 42 };
    autenticar.mockResolvedValue({ situacao: 'valido', acesso });
    const { ctx, requisicao } = contexto({ token: 'valido' });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(requisicao.acessoRecebedor).toBe(acesso);
  });
});
