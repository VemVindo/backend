import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Cargo } from '../common/enums/cargo.enum';
import { EmpresaRepository } from '../empresa/empresa.repository';
import { EntregadorRepository } from '../entregador/entregador.repository';
import { extrairTokenDoCookie } from './auth-cookie';

export interface ConteudoDoToken {
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
    configuracao: ConfigService,
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
      secretOrKey: configuracao.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(
    conteudoDoToken: ConteudoDoToken,
  ): Promise<UsuarioAutenticado> {
    if (
      !conteudoDoToken?.sub ||
      !Object.values(Cargo).includes(conteudoDoToken.cargo)
    ) {
      throw new UnauthorizedException();
    }
    const empresaSemEstabelecimento =
      conteudoDoToken.cargo === Cargo.ESTABELECIMENTO &&
      !conteudoDoToken.empresaId;
    if (
      empresaSemEstabelecimento ||
      typeof conteudoDoToken.versao !== 'number'
    ) {
      throw new UnauthorizedException();
    }
    const versaoAtual =
      conteudoDoToken.cargo === Cargo.ESTABELECIMENTO
        ? await this.empresas.versaoSessao(Number(conteudoDoToken.empresaId))
        : await this.entregadores.versaoSessao(conteudoDoToken.sub);
    if (versaoAtual !== conteudoDoToken.versao) {
      throw new UnauthorizedException('Sessao encerrada; entre novamente');
    }
    return {
      usuarioId: conteudoDoToken.sub,
      cargo: conteudoDoToken.cargo,
      empresaId: conteudoDoToken.empresaId,
      senhaTemporaria: conteudoDoToken.senhaTemporaria,
    };
  }
}
