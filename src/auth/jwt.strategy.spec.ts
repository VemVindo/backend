import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cargo } from '../common/enums/cargo.enum';
import { EmpresaRepository } from '../empresa/empresa.repository';
import { EntregadorRepository } from '../entregador/entregador.repository';
import { JwtPayload, JwtStrategy } from './jwt.strategy';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

function montar() {
  const config = {
    getOrThrow: () => 'segredo-de-teste-com-mais-de-32-caracteres',
  } as unknown as ConfigService;
  const empresas = { versaoSessao: jest.fn().mockResolvedValue(0) };
  const entregadores = { versaoSessao: jest.fn().mockResolvedValue(0) };
  const strategy = new JwtStrategy(
    config,
    empresas as unknown as EmpresaRepository,
    entregadores as unknown as EntregadorRepository,
  );
  return { strategy, empresas, entregadores };
}

describe('JwtStrategy.validate', () => {
  it('aceita token de empresa com empresaId e versao em dia', async () => {
    const { strategy, empresas } = montar();
    const payload: JwtPayload = {
      sub: '1',
      cargo: Cargo.ESTABELECIMENTO,
      empresaId: '1',
      versao: 0,
    };

    await expect(strategy.validate(payload)).resolves.toEqual({
      usuarioId: '1',
      cargo: Cargo.ESTABELECIMENTO,
      empresaId: '1',
      senhaTemporaria: undefined,
    });
    expect(empresas.versaoSessao).toHaveBeenCalledWith(1);
  });

  it('aceita token de entregador sem empresaId', async () => {
    const { strategy, entregadores } = montar();
    const payload: JwtPayload = {
      sub: '52998224725',
      cargo: Cargo.ENTREGADOR,
      senhaTemporaria: false,
      versao: 0,
    };

    const usuario = await strategy.validate(payload);

    expect(usuario.usuarioId).toBe('52998224725');
    expect(entregadores.versaoSessao).toHaveBeenCalledWith('52998224725');
  });

  it('recusa token de sessao encerrada (versao antiga)', async () => {
    const { strategy, entregadores } = montar();
    entregadores.versaoSessao.mockResolvedValue(1);

    await expect(
      strategy.validate({
        sub: '52998224725',
        cargo: Cargo.ENTREGADOR,
        versao: 0,
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('recusa token de usuario que nao existe mais', async () => {
    const { strategy, empresas } = montar();
    empresas.versaoSessao.mockResolvedValue(null);

    await expect(
      strategy.validate({
        sub: '1',
        cargo: Cargo.ESTABELECIMENTO,
        empresaId: '1',
        versao: 0,
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('recusa token emitido antes da versao de sessao existir', async () => {
    const { strategy, empresas } = montar();
    const antigo = { sub: '1', cargo: Cargo.ESTABELECIMENTO, empresaId: '1' };

    await expect(
      strategy.validate(antigo as unknown as JwtPayload),
    ).rejects.toThrow(UnauthorizedException);
    expect(empresas.versaoSessao).not.toHaveBeenCalled();
  });

  it('recusa token de empresa sem empresaId', async () => {
    const { strategy } = montar();
    await expect(
      strategy.validate({ sub: '1', cargo: Cargo.ESTABELECIMENTO, versao: 0 }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('recusa cargo desconhecido e token sem sub', async () => {
    const { strategy } = montar();
    await expect(
      strategy.validate({ sub: '1', cargo: 'ADMIN' as Cargo, versao: 0 }),
    ).rejects.toThrow(UnauthorizedException);
    await expect(
      strategy.validate({ cargo: Cargo.ENTREGADOR, versao: 0 } as JwtPayload),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('recusa token antigo, emitido com role em vez de cargo', async () => {
    const { strategy } = montar();
    const antigo = {
      sub: '1',
      role: Cargo.ESTABELECIMENTO,
      empresaId: '1',
      versao: 0,
    };
    await expect(
      strategy.validate(antigo as unknown as JwtPayload),
    ).rejects.toThrow(UnauthorizedException);
  });
});
