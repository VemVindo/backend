import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginEmpresaDto } from './dto/login.dto';
import { LoginEntregadorDto } from './dto/login-entregador.dto';
import { RegisterEstablishmentDto } from './dto/register-establishment.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterEstablishmentDto) {
    return this.authService.registerEstablishment(dto);
  }

  @Post('login/empresa')
  @HttpCode(HttpStatus.OK)
  loginEmpresa(@Body() dto: LoginEmpresaDto) {
    return this.authService.loginEmpresa(dto);
  }

  @Post('login/entregador')
  @HttpCode(HttpStatus.OK)
  loginEntregador(@Body() dto: LoginEntregadorDto) {
    return this.authService.loginEntregador(dto);
  }
}
