import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { Roles } from './decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import type { AuthenticatedUser } from './jwt.strategy';
import { LoginEmpresaDto } from './dto/login.dto';
import { LoginEntregadorDto } from './dto/login-entregador.dto';
import { RegisterEstablishmentDto } from './dto/register-establishment.dto';
import { TrocarSenhaDto } from './dto/trocar-senha.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterEstablishmentDto) {
    return this.authService.registerEstablishment(dto);
  }

  @Public()
  @Post('login/empresa')
  @HttpCode(HttpStatus.OK)
  loginEmpresa(@Body() dto: LoginEmpresaDto) {
    return this.authService.loginEmpresa(dto);
  }

  @Public()
  @Post('login/entregador')
  @HttpCode(HttpStatus.OK)
  loginEntregador(@Body() dto: LoginEntregadorDto) {
    return this.authService.loginEntregador(dto);
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user);
  }

  @Roles(UserRole.ENTREGADOR)
  @Post('entregador/trocar-senha')
  @HttpCode(HttpStatus.OK)
  trocarSenha(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TrocarSenhaDto,
  ) {
    return this.authService.trocarSenhaEntregador(user, dto);
  }
}
