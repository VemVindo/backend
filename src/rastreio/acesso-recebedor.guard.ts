import {
  CanActivate,
  ExecutionContext,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AcessoComPedido } from './rastreio.repository';
import { RastreioService } from './rastreio.service';

export type RequisicaoRecebedor = Request & {
  acessoRecebedor?: AcessoComPedido;
};

@Injectable()
export class AcessoRecebedorGuard implements CanActivate {
  constructor(private readonly rastreio: RastreioService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requisicao = context.switchToHttp().getRequest<RequisicaoRecebedor>();
    const token = requisicao.params?.token;
    const resultado = await this.rastreio.autenticar(
      typeof token === 'string' ? token : '',
    );
    if (resultado.situacao === 'invalido') {
      throw new NotFoundException('Link de rastreio invalido');
    }
    if (resultado.situacao === 'encerrado') {
      throw new GoneException(
        'Esta entrega ja foi encerrada; o link de rastreio expirou',
      );
    }
    requisicao.acessoRecebedor = resultado.acesso;
    return true;
  }
}
