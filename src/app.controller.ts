import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { RotaPublica } from './auth/decorators/rota-publica.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @RotaPublica()
  @Get()
  saudar() {
    return this.appService.saudar();
  }
}
