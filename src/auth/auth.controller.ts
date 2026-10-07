import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { definirCookieAuth, limparCookieAuth } from './auth-cookie';
import { Cargos } from './decorators/cargos.decorator';
import { PermitirSenhaTemporaria } from './decorators/permitir-senha-temporaria.decorator';
import { Public } from './decorators/public.decorator';
import { UsuarioAtual } from './decorators/usuario-atual.decorator';
import { Cargo } from '../common/enums/cargo.enum';
import type { UsuarioAutenticado } from './jwt.strategy';
import { CadastrarEmpresaDto } from './dto/cadastrar-empresa.dto';
import { LoginEmpresaDto } from './dto/login-empresa.dto';
import { LoginEntregadorDto } from './dto/login-entregador.dto';
import { TrocarSenhaDto } from './dto/trocar-senha.dto';

const LIMITE_TENTATIVAS_COM_SENHA = { default: { limit: 5, ttl: 60_000 } };

interface RespostaComToken<Usuario> {
  tokenAcesso: string;
  expiraEm: Date;
  usuario: Usuario;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private responderComCookie<Usuario>(
    res: Response,
    { tokenAcesso, expiraEm, usuario }: RespostaComToken<Usuario>,
  ) {
    definirCookieAuth(res, tokenAcesso, expiraEm);
    return { usuario };
  }

  @Public()
  @Throttle(LIMITE_TENTATIVAS_COM_SENHA)
  @Post('cadastrar/empresa')
  async cadastrarEmpresa(
    @Body() dto: CadastrarEmpresaDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.responderComCookie(
      res,
      await this.authService.cadastrarEmpresa(dto),
    );
  }

  @Public()
  @Throttle(LIMITE_TENTATIVAS_COM_SENHA)
  @Post('login/empresa')
  @HttpCode(HttpStatus.OK)
  async loginEmpresa(
    @Body() dto: LoginEmpresaDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.responderComCookie(
      res,
      await this.authService.loginEmpresa(dto),
    );
  }

  @Public()
  @Throttle(LIMITE_TENTATIVAS_COM_SENHA)
  @Post('login/entregador')
  @HttpCode(HttpStatus.OK)
  async loginEntregador(
    @Body() dto: LoginEntregadorDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.responderComCookie(
      res,
      await this.authService.loginEntregador(dto),
    );
  }

  @Public()
  @Post('sair')
  @HttpCode(HttpStatus.NO_CONTENT)
  sair(@Res({ passthrough: true }) res: Response) {
    limparCookieAuth(res);
  }

  @PermitirSenhaTemporaria()
  @Get('minhas-infos')
  minhasInformacoes(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.authService.minhasInformacoes(usuario);
  }

  @PermitirSenhaTemporaria()
  @Cargos(Cargo.ENTREGADOR)
  @Throttle(LIMITE_TENTATIVAS_COM_SENHA)
  @Post('entregador/trocar-senha')
  @HttpCode(HttpStatus.OK)
  async trocarSenha(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Body() dto: TrocarSenhaDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.responderComCookie(
      res,
      await this.authService.trocarSenhaEntregador(usuario, dto),
    );
  }
}
