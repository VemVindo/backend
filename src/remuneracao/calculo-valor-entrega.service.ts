import { BadRequestException, Injectable } from '@nestjs/common';

export interface DadosCalculoValorEntrega {
  distanciaMetros: number;
  taxaFixaCentavos: number;
  coeficienteCentavosKm: number;
}

const CAMPOS = [
  'distanciaMetros',
  'taxaFixaCentavos',
  'coeficienteCentavosKm',
] as const;
const MAX_INT_PRISMA = 2_147_483_647n;

@Injectable()
export class CalculoValorEntregaService {
  calcularValorEntrega(dados: DadosCalculoValorEntrega): number {
    if (!dados || typeof dados !== 'object' || Array.isArray(dados)) {
      throw new BadRequestException('Dados de calculo invalidos');
    }

    for (const campo of CAMPOS) {
      const valor = dados[campo];
      if (
        typeof valor !== 'number' ||
        !Number.isSafeInteger(valor) ||
        valor < 0
      ) {
        throw new BadRequestException(
          `${campo} deve ser um inteiro seguro nao negativo`,
        );
      }
    }

    const numerador =
      BigInt(dados.taxaFixaCentavos) * 1000n +
      BigInt(dados.coeficienteCentavosKm) * BigInt(dados.distanciaMetros);
    const resultado = (numerador + 500n) / 1000n;

    if (
      resultado > BigInt(Number.MAX_SAFE_INTEGER) ||
      resultado > MAX_INT_PRISMA
    ) {
      throw new BadRequestException(
        'Valor da entrega excede o limite permitido',
      );
    }

    return Number(resultado);
  }
}
