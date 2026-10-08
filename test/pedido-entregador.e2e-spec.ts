import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { Cargo } from './../src/common/enums/cargo.enum';
import { PrismaService } from './../src/prisma/prisma.service';

const EMAIL_EMPRESA = 'e2e-pedidos@example.com';
const CPF_COM_DOIS_PEDIDOS = '11144477735';
const CPF_COM_UM_PEDIDO = '39053344705';
const CPF_SEM_PEDIDOS = '86288366757';
const TELEFONE_RECEBEDOR = '61955550000';
const DESCRICAO_DO_PEDIDO = 'Pedido de teste';

interface PedidoDaResposta {
  recebedor: string;
  status: string;
  empresa: string;
  endereco: string;
}

describe('GET /entregador/pedidos (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwt: JwtService;

  function token(cargo: Cargo, usuarioId: string, senhaTemporaria = false) {
    const empresaId = cargo === Cargo.ESTABELECIMENTO ? usuarioId : undefined;
    return jwt.sign({ sub: usuarioId, cargo, empresaId, senhaTemporaria });
  }

  async function limpar() {
    const cpfs = [CPF_COM_DOIS_PEDIDOS, CPF_COM_UM_PEDIDO, CPF_SEM_PEDIDOS];
    await prisma.pedido.deleteMany({
      where: { empresa: { email: EMAIL_EMPRESA } },
    });
    await prisma.entregador.deleteMany({ where: { cpf: { in: cpfs } } });
    await prisma.empresa.deleteMany({ where: { email: EMAIL_EMPRESA } });
  }

  async function criarPedido(
    idEmpresa: number,
    cpfEntregador: string,
    recebedor: string,
    status: string,
    criadoEm: string,
  ) {
    await prisma.pedido.create({
      data: {
        nome_recebedor: recebedor,
        telefone_recebedor: TELEFONE_RECEBEDOR,
        cep: '70000000',
        logradouro: 'Rua das Flores',
        numero: 100,
        bairro: 'Centro',
        cidade: 'Brasilia',
        uf: 'DF',
        descricao: DESCRICAO_DO_PEDIDO,
        status,
        data_criacao: new Date(criadoEm),
        valor_entrega: 1250,
        distancia: 3,
        idEmpresa,
        cpf_entregador: cpfEntregador,
      },
    });
  }

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = modulo.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService, { strict: false });

    await limpar();
    const empresa = await prisma.empresa.create({
      data: {
        nome_fantasia: 'Empresa E2E',
        email: EMAIL_EMPRESA,
        telefone: '61900000000',
        cep: '70000000',
        logradouro: 'Rua das Flores',
        numero: 100,
        bairro: 'Centro',
        cidade: 'Brasilia',
        UF: 'DF',
        senha: 'hash',
      },
    });
    await prisma.entregador.createMany({
      data: [CPF_COM_DOIS_PEDIDOS, CPF_COM_UM_PEDIDO, CPF_SEM_PEDIDOS].map(
        (cpf) => ({
          cpf,
          nome: 'Entregador E2E',
          telefone: '61910000000',
          tipo_veiculo: 'MOTO',
          senha: 'hash',
          senha_temporaria: false,
        }),
      ),
    });
    const id = empresa.id_empresa;
    await criarPedido(
      id,
      CPF_COM_DOIS_PEDIDOS,
      'Recebedor Antigo',
      'CONCLUIDO',
      '2026-10-01T10:00:00Z',
    );
    await criarPedido(
      id,
      CPF_COM_DOIS_PEDIDOS,
      'Recebedor Recente',
      'EM_ANDAMENTO',
      '2026-10-02T10:00:00Z',
    );
    await criarPedido(
      id,
      CPF_COM_UM_PEDIDO,
      'Recebedor de Outro',
      'ATRIBUIDO',
      '2026-10-03T10:00:00Z',
    );
  });

  afterAll(async () => {
    await limpar();
    await app.close();
  });

  it.each([
    ['sem login', undefined, 401],
    [
      'logado como estabelecimento',
      () => token(Cargo.ESTABELECIMENTO, '1'),
      403,
    ],
    [
      'entregador com senha temporaria',
      () => token(Cargo.ENTREGADOR, CPF_COM_DOIS_PEDIDOS, true),
      403,
    ],
    [
      'entregador com senha definitiva',
      () => token(Cargo.ENTREGADOR, CPF_COM_DOIS_PEDIDOS),
      200,
    ],
  ])('%s responde %i', async (_caso, gerarToken, statusEsperado) => {
    const requisicao = request(app.getHttpServer()).get('/entregador/pedidos');
    if (gerarToken) {
      void requisicao.set('Authorization', `Bearer ${gerarToken()}`);
    }
    await requisicao.expect(statusEsperado);
  });

  it.each([
    [CPF_COM_DOIS_PEDIDOS, ['Recebedor Recente', 'Recebedor Antigo']],
    [CPF_COM_UM_PEDIDO, ['Recebedor de Outro']],
    [CPF_SEM_PEDIDOS, []],
  ])(
    'entregador %s ve apenas os proprios pedidos, do mais recente ao mais antigo',
    async (cpf, recebedoresEsperados) => {
      const resposta = await request(app.getHttpServer())
        .get('/entregador/pedidos')
        .set('Authorization', `Bearer ${token(Cargo.ENTREGADOR, cpf)}`)
        .expect(200);

      const pedidos = resposta.body as PedidoDaResposta[];
      expect(pedidos.map((pedido) => pedido.recebedor)).toEqual(
        recebedoresEsperados,
      );
    },
  );

  it('devolve status, empresa e endereco, sem telefone nem conteudo do pedido', async () => {
    const resposta = await request(app.getHttpServer())
      .get('/entregador/pedidos')
      .set(
        'Authorization',
        `Bearer ${token(Cargo.ENTREGADOR, CPF_COM_UM_PEDIDO)}`,
      )
      .expect(200);

    const [pedido] = resposta.body as PedidoDaResposta[];
    expect(pedido).toMatchObject({
      status: 'ATRIBUIDO',
      empresa: 'Empresa E2E',
      endereco: 'Rua das Flores, 100 - Centro, Brasilia/DF',
    });
    expect(resposta.text).not.toContain(TELEFONE_RECEBEDOR);
    expect(resposta.text).not.toContain(DESCRICAO_DO_PEDIDO);
  });
});
