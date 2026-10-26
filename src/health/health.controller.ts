import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RotaPublica } from '../auth/decorators/rota-publica.decorator';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @RotaPublica()
  @Get('db')
  async verificarBanco() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { database: 'up' };
  }
}
