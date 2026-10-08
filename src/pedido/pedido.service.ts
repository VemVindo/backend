import { Injectable } from '@nestjs/common';
import { PedidoRepository } from './pedido.repository';

@Injectable()
export class PedidoService {
  constructor(private readonly pedidos: PedidoRepository) {}

  listarAtivos(id_empresa: number) {
    return this.pedidos.listarAtivosPorEmpresa(id_empresa);
  }
}
