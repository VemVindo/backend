import type { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';

type FabricaDeParametro = (
  dadoDoDecorator: unknown,
  contexto: ExecutionContext,
) => unknown;

type DecoratorDeParametro = () => ParameterDecorator;

export function contextoHttp(requisicao: object): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => requisicao }),
  } as unknown as ExecutionContext;
}

export function fabricaDoDecorator(
  decorator: DecoratorDeParametro,
): FabricaDeParametro {
  class RotaDeTeste {
    rota() {}
  }
  decorator()(RotaDeTeste.prototype, 'rota', 0);
  const argumentos = Reflect.getMetadata(
    ROUTE_ARGS_METADATA,
    RotaDeTeste,
    'rota',
  ) as Record<string, { factory: FabricaDeParametro }>;
  const [argumento] = Object.values(argumentos);
  return argumento.factory;
}
