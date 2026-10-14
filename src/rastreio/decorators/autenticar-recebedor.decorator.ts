import { applyDecorators, UseGuards } from '@nestjs/common';
import { Public } from '../../auth/decorators/public.decorator';
import { AcessoRecebedorGuard } from '../acesso-recebedor.guard';

export const AutenticarRecebedor = () =>
  applyDecorators(Public(), UseGuards(AcessoRecebedorGuard));
