import { Injectable } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { RastreioRepository } from './rastreio.repository';

export const LIMITE_TENTATIVAS_CODIGO = 5;
export const BLOQUEIO_CODIGO_MS = 15 * 60_000;

export type ConferenciaDoCodigo =
  | { situacao: 'correto' }
  | { situacao: 'incorreto'; tentativasRestantes: number }
  | { situacao: 'bloqueado'; liberaEm: Date }
  | { situacao: 'sem_codigo' };

@Injectable()
export class CodigoDoRecebedorService {
  constructor(private readonly rastreio: RastreioRepository) {}

  async conferir(
    idPedido: number,
    codigo: string,
    agora = new Date(),
  ): Promise<ConferenciaDoCodigo> {
    const acesso = await this.rastreio.procurarAcessoDoPedido(idPedido);
    if (!acesso) {
      return { situacao: 'sem_codigo' };
    }

    const ultima = acesso.ultima_tentativa_codigo;
    const tentativas =
      ultima && dentroDoBloqueio(ultima, agora) ? acesso.tentativas_codigo : 0;
    if (ultima && tentativas >= LIMITE_TENTATIVAS_CODIGO) {
      return { situacao: 'bloqueado', liberaEm: fimDoBloqueio(ultima) };
    }
    if (codigosIguais(codigo, acesso.codigo_recebedor)) {
      return { situacao: 'correto' };
    }

    await this.rastreio.registrarTentativaErrada(
      idPedido,
      tentativas + 1,
      agora,
    );
    return {
      situacao: 'incorreto',
      tentativasRestantes: LIMITE_TENTATIVAS_CODIGO - tentativas - 1,
    };
  }
}

function dentroDoBloqueio(ultima: Date, agora: Date): boolean {
  return agora.getTime() - ultima.getTime() < BLOQUEIO_CODIGO_MS;
}

function fimDoBloqueio(ultima: Date): Date {
  return new Date(ultima.getTime() + BLOQUEIO_CODIGO_MS);
}

function codigosIguais(informado: string, esperado: string): boolean {
  const bytesInformados = Buffer.from(informado);
  const bytesEsperados = Buffer.from(esperado);
  return (
    bytesInformados.length === bytesEsperados.length &&
    timingSafeEqual(bytesInformados, bytesEsperados)
  );
}
