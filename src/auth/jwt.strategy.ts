import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Cargo } from '../common/enums/cargo.enum';
import { extrairTokenDoCookie } from './auth-cookie';

export interface JwtPayload {
  sub: string;
  cargo: Cargo;
  empresaId?: string;
  senhaTemporaria?: boolean;
}

export interface UsuarioAutenticado {
  usuarioId: string;
  cargo: Cargo;
  empresaId?: string;
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

  validate(payload: JwtPayload): UsuarioAutenticado {
    if (!payload?.sub || !Object.values(Cargo).includes(payload.cargo)) {
      throw new UnauthorizedException();
    }
    const empresaSemEstabelecimento =
      payload.cargo === Cargo.ESTABELECIMENTO && !payload.empresaId;
    if (empresaSemEstabelecimento) {
      throw new UnauthorizedException();
    }
    return {
      usuarioId: payload.sub,
      cargo: payload.cargo,
      empresaId: payload.empresaId,
      senhaTemporaria: payload.senhaTemporaria,
    };
  }
}
