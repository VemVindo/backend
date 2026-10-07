import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Cargo } from '../common/enums/cargo.enum';
import { EmpresaRepository } from '../empresa/empresa.repository';
import { EntregadorRepository } from '../entregador/entregador.repository';
import { extrairTokenDoCookie } from './auth-cookie';

export interface JwtPayload {
  sub: string;
  cargo: Cargo;
  empresaId?: string;
  senhaTemporaria?: boolean;
  versao: number;
}

export interface UsuarioAutenticado {
  usuarioId: string;
  cargo: Cargo;
  empresaId?: string;
  senhaTemporaria?: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly empresas: EmpresaRepository,
    private readonly entregadores: EntregadorRepository,
  ) {
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

  // A versao da sessao e conferida no banco a cada requisicao: trocar a senha
  // ou sair de todos os aparelhos invalida os tokens emitidos antes.
  async validate(payload: JwtPayload): Promise<UsuarioAutenticado> {
    if (!payload?.sub || !Object.values(Cargo).includes(payload.cargo)) {
      throw new UnauthorizedException();
    }
    const empresaSemEstabelecimento =
      payload.cargo === Cargo.ESTABELECIMENTO && !payload.empresaId;
    if (empresaSemEstabelecimento || typeof payload.versao !== 'number') {
      throw new UnauthorizedException();
    }
    const versaoAtual =
      payload.cargo === Cargo.ESTABELECIMENTO
        ? await this.empresas.versaoSessao(Number(payload.empresaId))
        : await this.entregadores.versaoSessao(payload.sub);
    if (versaoAtual !== payload.versao) {
      throw new UnauthorizedException('Sessao encerrada; entre novamente');
    }
    return {
      usuarioId: payload.sub,
      cargo: payload.cargo,
      empresaId: payload.empresaId,
      senhaTemporaria: payload.senhaTemporaria,
    };
  }
}
