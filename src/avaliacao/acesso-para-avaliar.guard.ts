import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { RequisicaoRecebedor } from '../rastreio/acesso-recebedor.guard';
import { ValidadorDeLink } from '../rastreio/validador-de-link';

@Injectable()
export class AcessoParaAvaliarGuard implements CanActivate {
  constructor(private readonly validador: ValidadorDeLink) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const requisicao = contexto
      .switchToHttp()
      .getRequest<RequisicaoRecebedor>();
    const token = requisicao.params?.token;
    const acesso = await this.validador.procurarAcesso(
      typeof token === 'string' ? token : '',
    );
    if (!acesso) {
      throw new NotFoundException('Link de rastreio invalido');
    }
    requisicao.acessoRecebedor = acesso;
    return true;
  }
}
