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
import { CurrentUser } from './decorators/current-user.decorator';
import { PermitirSenhaTemporaria } from './decorators/permitir-senha-temporaria.decorator';
import { Public } from './decorators/public.decorator';
import { Roles } from './decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import type { AuthenticatedUser } from './jwt.strategy';
import { LoginEmpresaDto } from './dto/login.dto';
import { LoginEntregadorDto } from './dto/login-entregador.dto';
import { RegisterEstablishmentDto } from './dto/register-establishment.dto';
import { TrocarSenhaDto } from './dto/trocar-senha.dto';

const LIMITE_TENTATIVAS_COM_SENHA = { default: { limit: 5, ttl: 60_000 } };

interface RespostaComToken<Usuario> {
  accessToken: string;
  expiraEm: Date;
  user: Usuario;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private responderComCookie<Usuario>(
    res: Response,
    { accessToken, expiraEm, user }: RespostaComToken<Usuario>,
  ) {
    definirCookieAuth(res, accessToken, expiraEm);
    return { user };
  }

  @Public()
  @Throttle(LIMITE_TENTATIVAS_COM_SENHA)
  @Post('register')
  async register(
    @Body() dto: RegisterEstablishmentDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.responderComCookie(
      res,
      await this.authService.registerEstablishment(dto),
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
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Res({ passthrough: true }) res: Response) {
    limparCookieAuth(res);
  }

  @PermitirSenhaTemporaria()
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user);
  }

  @PermitirSenhaTemporaria()
  @Roles(UserRole.ENTREGADOR)
  @Throttle(LIMITE_TENTATIVAS_COM_SENHA)
  @Post('entregador/trocar-senha')
  @HttpCode(HttpStatus.OK)
  async trocarSenha(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TrocarSenhaDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.responderComCookie(
      res,
      await this.authService.trocarSenhaEntregador(user, dto),
    );
  }
}
