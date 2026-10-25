import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { CANTINA, entrarComoEmpresa, subirAplicacao } from './apoio/aplicacao';

interface PedidoDaLista {
  recebedor: string;
  status: string;
  valorEntrega: number;
  finalizadoEm: string | null;
  nota: number | null;
}

describe('GET /pedidos (e2e)', () => {
  let app: INestApplication<App>;
  let pedidos: PedidoDaLista[];

  beforeAll(async () => {
    app = await subirAplicacao();

    const empresa = await entrarComoEmpresa(app, CANTINA.email);
    const resposta = await empresa.get('/pedidos').expect(200);
    pedidos = resposta.body as PedidoDaLista[];
  });

  afterAll(async () => {
    await app.close();
  });

  it('recusa quem nao fez login', () => {
    return request(app.getHttpServer()).get('/pedidos').expect(401);
  });

  it.each([
    ['Marina Costa', 'FINALIZADO', 1310, true],
    ['Joao Pereira', 'PENDENTE', 1430, false],
    ['Rafael Nunes', 'PENDENTE', 1115, false],
  ])(
    'mostra o pedido de %s com status %s, valor %d e data de conclusao: %s',
    (recebedor, status, valorEntrega, temConclusao) => {
      const pedido = pedidos.find((atual) => atual.recebedor === recebedor);

      expect(pedido).toMatchObject({ status, valorEntrega, nota: null });
      expect(pedido?.finalizadoEm !== null).toBe(temConclusao);
    },
  );
});
