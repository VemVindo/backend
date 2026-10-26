import { applyDecorators, UseGuards } from '@nestjs/common';
import { RotaPublica } from '../../auth/decorators/rota-publica.decorator';
import { AcessoRecebedorGuard } from '../acesso-recebedor.guard';

export const AutenticarRecebedor = () =>
  applyDecorators(RotaPublica(), UseGuards(AcessoRecebedorGuard));
