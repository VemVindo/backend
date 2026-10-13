import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { SemCacheInterceptor } from './sem-cache.interceptor';

describe('SemCacheInterceptor', () => {
  it('marca a resposta como no-store antes de chamar o handler', () => {
    const setHeader = jest.fn();
    const handle = jest.fn(() => of(null));
    const context = {
      switchToHttp: () => ({ getResponse: () => ({ setHeader }) }),
    } as unknown as ExecutionContext;

    new SemCacheInterceptor().intercept(context, { handle } as CallHandler);

    expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(setHeader.mock.invocationCallOrder[0]).toBeLessThan(
      handle.mock.invocationCallOrder[0],
    );
  });
});
