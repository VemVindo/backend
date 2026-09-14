import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Entregador } from '../generated/prisma/client';

@Injectable()
export class EntregadorRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByCpf(cpf: string): Promise<Entregador | null> {
    return this.prisma.entregador.findUnique({ where: { cpf } });
  }
}
