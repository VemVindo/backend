import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { Observable } from 'rxjs';

@Injectable()
export class SemCacheInterceptor implements NestInterceptor {
  intercept(
    contexto: ExecutionContext,
    proximo: CallHandler,
  ): Observable<unknown> {
    contexto
      .switchToHttp()
      .getResponse<Response>()
      .setHeader('Cache-Control', 'no-store');
    return proximo.handle();
  }
}
