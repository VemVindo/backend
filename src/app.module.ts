import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { SenhaModule } from './common/security/senha.module';
import { SemCacheInterceptor } from './common/interceptors/sem-cache.interceptor';
import { AuthModule } from './auth/auth.module';
import { validateEnv } from './config/env.validation';
import { HealthController } from './health/health.controller';
import { EmpresaModule } from './empresa/empresa.module';
import { EntregadorModule } from './entregador/entregador.module';
import { VinculoModule } from './vinculo/vinculo.module';
import { PedidoModule } from './pedido/pedido.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    SenhaModule,
    EmpresaModule,
    EntregadorModule,
    VinculoModule,
    PedidoModule,
    AuthModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: SemCacheInterceptor },
  ],
})
export class AppModule {}
