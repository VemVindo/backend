import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../auth/decorators/public.decorator';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('db')
  async checkDatabase() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { database: 'up' };
  }
}
