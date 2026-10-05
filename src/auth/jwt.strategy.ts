import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserRole } from '../common/enums/user-role.enum';
import { extrairTokenDoCookie } from './auth-cookie';

export interface JwtPayload {
  sub: string;
  role: UserRole;
  establishmentId?: string;
  senhaTemporaria?: boolean;
}

export interface AuthenticatedUser {
  userId: string;
  role: UserRole;
  establishmentId?: string;
  senhaTemporaria?: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        extrairTokenDoCookie,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      algorithms: ['HS256'],
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    if (!payload?.sub || !Object.values(UserRole).includes(payload.role)) {
      throw new UnauthorizedException();
    }
    const empresaSemEstabelecimento =
      payload.role === UserRole.ESTABELECIMENTO && !payload.establishmentId;
    if (empresaSemEstabelecimento) {
      throw new UnauthorizedException();
    }
    return {
      userId: payload.sub,
      role: payload.role,
      establishmentId: payload.establishmentId,
      senhaTemporaria: payload.senhaTemporaria,
    };
  }
}
