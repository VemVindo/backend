import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '../common/enums/user-role.enum';
import { JwtPayload, JwtStrategy } from './jwt.strategy';

describe('JwtStrategy.validate', () => {
  const config = {
    getOrThrow: () => 'segredo-de-teste-com-mais-de-32-caracteres',
  } as unknown as ConfigService;
  const strategy = new JwtStrategy(config);

  it('aceita token de empresa com establishmentId', () => {
    const payload: JwtPayload = {
      sub: '1',
      role: UserRole.ESTABELECIMENTO,
      establishmentId: '1',
    };
    expect(strategy.validate(payload)).toEqual({
      userId: '1',
      role: UserRole.ESTABELECIMENTO,
      establishmentId: '1',
      senhaTemporaria: undefined,
    });
  });

  it('aceita token de entregador sem establishmentId', () => {
    const payload: JwtPayload = {
      sub: '52998224725',
      role: UserRole.ENTREGADOR,
      senhaTemporaria: false,
    };
    expect(strategy.validate(payload).userId).toBe('52998224725');
  });

  it('recusa token de empresa sem establishmentId', () => {
    expect(() =>
      strategy.validate({ sub: '1', role: UserRole.ESTABELECIMENTO }),
    ).toThrow(UnauthorizedException);
  });

  it('recusa papel desconhecido e token sem sub', () => {
    expect(() =>
      strategy.validate({ sub: '1', role: 'ADMIN' as UserRole }),
    ).toThrow(UnauthorizedException);
    expect(() =>
      strategy.validate({ role: UserRole.ENTREGADOR } as JwtPayload),
    ).toThrow(UnauthorizedException);
  });
});
