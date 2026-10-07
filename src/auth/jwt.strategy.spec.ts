import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cargo } from '../common/enums/cargo.enum';
import { JwtPayload, JwtStrategy } from './jwt.strategy';

describe('JwtStrategy.validate', () => {
  const config = {
    getOrThrow: () => 'segredo-de-teste-com-mais-de-32-caracteres',
  } as unknown as ConfigService;
  const strategy = new JwtStrategy(config);

  it('aceita token de empresa com empresaId', () => {
    const payload: JwtPayload = {
      sub: '1',
      cargo: Cargo.ESTABELECIMENTO,
      empresaId: '1',
    };
    expect(strategy.validate(payload)).toEqual({
      usuarioId: '1',
      cargo: Cargo.ESTABELECIMENTO,
      empresaId: '1',
      senhaTemporaria: undefined,
    });
  });

  it('aceita token de entregador sem empresaId', () => {
    const payload: JwtPayload = {
      sub: '52998224725',
      cargo: Cargo.ENTREGADOR,
      senhaTemporaria: false,
    };
    expect(strategy.validate(payload).usuarioId).toBe('52998224725');
  });

  it('recusa token de empresa sem empresaId', () => {
    expect(() =>
      strategy.validate({ sub: '1', cargo: Cargo.ESTABELECIMENTO }),
    ).toThrow(UnauthorizedException);
  });

  it('recusa cargo desconhecido e token sem sub', () => {
    expect(() =>
      strategy.validate({ sub: '1', cargo: 'ADMIN' as Cargo }),
    ).toThrow(UnauthorizedException);
    expect(() =>
      strategy.validate({ cargo: Cargo.ENTREGADOR } as JwtPayload),
    ).toThrow(UnauthorizedException);
  });

  it('recusa token antigo, emitido com role em vez de cargo', () => {
    const antigo = { sub: '1', role: Cargo.ESTABELECIMENTO, empresaId: '1' };
    expect(() => strategy.validate(antigo as unknown as JwtPayload)).toThrow(
      UnauthorizedException,
    );
  });
});
