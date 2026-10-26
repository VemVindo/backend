import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import { hash } from 'bcryptjs';
import { Pool } from 'pg';
import requisicaoHttp from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { Prisma, PrismaClient } from '../src/generated/prisma/client';
import { StatusContrato, StatusPedido } from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';
import { DesempenhoEntregadorDto } from '../src/entregador/dto/desempenho-entregador.dto';

const urlBancoTeste = process.env.TEST_DATABASE_URL;
const descreverIntegracao = urlBancoTeste ? describe : describe.skip;

descreverIntegracao('E-US18: endpoint real e agregacoes PostgreSQL', () => {
  const esquemaTeste = `eus18_${randomUUID().replaceAll('-', '')}`;
  const cpfEntregador = '52998224725';
  const cpfOutroEntregador = '11144477735';
  const periodoConsulta = {
    de: '2026-10-01T00:00:00-03:00',
    ate: '2026-11-01T00:00:00-03:00',
  };
  const rotaDesempenho = `/entregadores/${cpfEntregador}/desempenho`;
  let conexaoAdministrativa: Pool;
  let conexaoSql: Pool;
  let clientePrisma: PrismaClient;
  let aplicacao: INestApplication<App>;
  let idEmpresaAutenticada: number;
  let idOutraEmpresa: number;
  let sessaoEmpresa: ReturnType<typeof requisicaoHttp.agent>;
  let sessaoOutraEmpresa: ReturnType<typeof requisicaoHttp.agent>;
  let sessaoEntregador: ReturnType<typeof requisicaoHttp.agent>;

  async function criarPedidoEntrega(
    alteracoesPedido: Partial<Prisma.PedidoUncheckedCreateInput> = {},
  ) {
    return clientePrisma.pedido.create({
      data: {
        nome_recebedor: 'Recebedor',
        telefone_recebedor: '61999999999',
        cep: '70000000',
        logradouro: 'Rua',
        numero: 1,
        bairro: 'Centro',
        cidade: 'Brasilia',
        uf: 'DF',
        descricao: 'E-US18',
        status: StatusPedido.FINALIZADO,
        data_criacao: new Date('2026-10-10T09:00:00Z'),
        data_inicio_entrega: new Date('2026-10-10T09:00:00Z'),
        data_finalizacao: new Date('2026-10-10T11:00:00Z'),
        valor_entrega: 0,
        idEmpresa: idEmpresaAutenticada,
        cpf_entregador: cpfEntregador,
        distancia: 1000,
        distancia_conhecida: true,
        ...alteracoesPedido,
      },
    });
  }

  async function registrarAtribuicao(
    idPedido: number,
    dataAtribuicao = '2026-10-10T10:40:00Z',
    cpfNovoEntregador = cpfEntregador,
    cpfEntregadorAnterior: string | null = null,
  ) {
    await clientePrisma.historicoPedidoEntregadores.create({
      data: {
        id_pedido: idPedido,
        data: new Date(dataAtribuicao),
        cpf_entregador_novo: cpfNovoEntregador,
        cpf_entregador_antigo: cpfEntregadorAnterior,
      },
    });
  }

  async function registrarAvaliacao(idPedido: number, nota: number) {
    await clientePrisma.avaliacao.create({
      data: {
        idpedidos: idPedido,
        avaliacao_entrega: nota,
        data: new Date('2026-11-02T00:00:00Z'),
      },
    });
  }

  async function consultarDesempenho() {
    const respostaDesempenho = await sessaoEmpresa
      .get(rotaDesempenho)
      .query(periodoConsulta)
      .expect(200);
    return respostaDesempenho.body as DesempenhoEntregadorDto;
  }

  async function abrirConexoesTeste() {
    conexaoAdministrativa = new Pool({
      connectionString: urlBancoTeste,
      connectionTimeoutMillis: 5000,
    });
    await conexaoAdministrativa.query(`CREATE SCHEMA "${esquemaTeste}"`);
    conexaoSql = new Pool({
      connectionString: urlBancoTeste,
      options: `-c search_path=${esquemaTeste}`,
      connectionTimeoutMillis: 5000,
    });
  }

  async function aplicarMigracoesTeste() {
    const pastaMigracoes = join(__dirname, '../prisma/migrations');
    const nomesMigracoes = readdirSync(pastaMigracoes)
      .filter((nomeMigracao) => /^\d/.test(nomeMigracao))
      .sort();
    for (const nomeMigracao of nomesMigracoes) {
      await conexaoSql.query(
        readFileSync(
          join(pastaMigracoes, nomeMigracao, 'migration.sql'),
          'utf8',
        ),
      );
    }
  }

  function configurarClientePrisma() {
    clientePrisma = new PrismaClient({
      adapter: new PrismaPg(
        {
          connectionString: urlBancoTeste,
          options: `-c search_path=${esquemaTeste}`,
        },
        { schema: esquemaTeste },
      ),
    });
  }

  async function cadastrarEmpresaTeste(
    emailEmpresa: string,
    senhaCriptografada: string,
  ) {
    const empresaCadastrada = await clientePrisma.empresa.create({
      data: {
        nome_fantasia: 'E-US18',
        email: emailEmpresa,
        telefone: '61999999999',
        cep: '70000000',
        logradouro: 'Rua',
        numero: 1,
        bairro: 'Centro',
        cidade: 'Brasilia',
        UF: 'DF',
        senha: senhaCriptografada,
      },
    });
    return empresaCadastrada.id_empresa;
  }

  async function cadastrarEntregadoresTeste(senhaCriptografada: string) {
    for (const cpfCadastrado of [cpfEntregador, cpfOutroEntregador]) {
      await clientePrisma.entregador.create({
        data: {
          cpf: cpfCadastrado,
          nome: 'Entregador',
          telefone: '61999999999',
          tipo_veiculo: 'MOTO',
          senha: senhaCriptografada,
          senha_temporaria: false,
          disponivel: false,
        },
      });
    }
  }

  async function cadastrarVinculoAtivo() {
    await clientePrisma.contrato.create({
      data: {
        idEmpresa: idEmpresaAutenticada,
        cpf_entregador: cpfEntregador,
        status: StatusContrato.ATIVO,
        data_inicio: new Date('2026-01-01T00:00:00Z'),
      },
    });
  }

  async function prepararCadastrosTeste() {
    const senhaCriptografada = await hash('Vemvindo@123', 4);
    idEmpresaAutenticada = await cadastrarEmpresaTeste(
      'a@eus18.test',
      senhaCriptografada,
    );
    idOutraEmpresa = await cadastrarEmpresaTeste(
      'b@eus18.test',
      senhaCriptografada,
    );
    await cadastrarEntregadoresTeste(senhaCriptografada);
    await cadastrarVinculoAtivo();
  }

  async function iniciarAplicacaoTeste() {
    const moduloTeste = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(clientePrisma)
      .compile();
    aplicacao = moduloTeste.createNestApplication();
    aplicacao.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await aplicacao.init();
  }

  async function autenticarSessoesTeste() {
    sessaoEmpresa = requisicaoHttp.agent(aplicacao.getHttpServer());
    sessaoOutraEmpresa = requisicaoHttp.agent(aplicacao.getHttpServer());
    sessaoEntregador = requisicaoHttp.agent(aplicacao.getHttpServer());
    await sessaoEmpresa
      .post('/auth/login/empresa')
      .send({ email: 'a@eus18.test', senha: 'Vemvindo@123' })
      .expect(200);
    await sessaoOutraEmpresa
      .post('/auth/login/empresa')
      .send({ email: 'b@eus18.test', senha: 'Vemvindo@123' })
      .expect(200);
    await sessaoEntregador
      .post('/auth/login/entregador')
      .send({ cpf: cpfEntregador, senha: 'Vemvindo@123' })
      .expect(200);
  }

  beforeAll(async () => {
    await abrirConexoesTeste();
    await aplicarMigracoesTeste();
    configurarClientePrisma();
    await prepararCadastrosTeste();
    await iniciarAplicacaoTeste();
    await autenticarSessoesTeste();
  }, 60_000);

  beforeEach(async () => {
    await clientePrisma.contrato.deleteMany({
      where: { idEmpresa: idOutraEmpresa },
    });
    await clientePrisma.avaliacao.deleteMany();
    await clientePrisma.historicoPedidoEntregadores.deleteMany();
    await clientePrisma.pedido.deleteMany();
    await clientePrisma.contrato.updateMany({
      data: { status: StatusContrato.ATIVO, data_fim: null },
    });
  });

  afterAll(async () => {
    if (aplicacao) await aplicacao.close();
    if (clientePrisma) await clientePrisma.$disconnect();
    if (conexaoSql) await conexaoSql.end();
    if (conexaoAdministrativa) {
      await conexaoAdministrativa.query(
        `DROP SCHEMA IF EXISTS "${esquemaTeste}" CASCADE`,
      );
      await conexaoAdministrativa.end();
    }
  });

  it('agrega primeira atribuicao, reatribuicao e retorno sem duplicar os indicadores', async () => {
    const pedidoPrimeiraAtribuicao = await criarPedidoEntrega();
    await registrarAtribuicao(pedidoPrimeiraAtribuicao.id_pedido);
    await registrarAvaliacao(pedidoPrimeiraAtribuicao.id_pedido, 0);
    const pedidoReatribuido = await criarPedidoEntrega({ distancia: 2000 });
    await registrarAtribuicao(
      pedidoReatribuido.id_pedido,
      '2026-10-10T09:00:00Z',
      cpfEntregador,
    );
    await registrarAtribuicao(
      pedidoReatribuido.id_pedido,
      '2026-10-10T10:00:00Z',
      cpfOutroEntregador,
      cpfEntregador,
    );
    await registrarAtribuicao(
      pedidoReatribuido.id_pedido,
      '2026-10-10T10:30:00Z',
      cpfEntregador,
      cpfOutroEntregador,
    );
    await registrarAvaliacao(pedidoReatribuido.id_pedido, 5);
    const pedidoSemAvaliacao = await criarPedidoEntrega({ distancia: 0 });
    await registrarAtribuicao(
      pedidoSemAvaliacao.id_pedido,
      '2026-10-10T10:50:00Z',
    );
    expect(await consultarDesempenho()).toEqual({
      cpf_entregador: cpfEntregador,
      periodo: {
        de: '2026-10-01T03:00:00.000Z',
        ate: '2026-11-01T03:00:00.000Z',
      },
      total_entregas: 3,
      tempo_medio_entrega_segundos: 1200,
      entregas_com_tempo_valido: 3,
      entregas_sem_tempo_valido: 0,
      avaliacao_media: 2.5,
      total_avaliacoes: 2,
      distancia_total_metros: 3000,
      distancia_conhecida_metros: 3000,
      entregas_com_distancia_conhecida: 3,
      entregas_com_distancia_desconhecida: 0,
    });
  });

  it('isola empresa e entregador e inclui somente FINALIZADO no periodo selecionado', async () => {
    await clientePrisma.contrato.create({
      data: {
        idEmpresa: idOutraEmpresa,
        cpf_entregador: cpfEntregador,
        status: StatusContrato.ATIVO,
        data_inicio: new Date('2026-01-01T00:00:00Z'),
      },
    });
    const pedidoElegivel = await criarPedidoEntrega();
    await registrarAvaliacao(pedidoElegivel.id_pedido, 0);
    const pedidoOutraEmpresa = await criarPedidoEntrega({
      idEmpresa: idOutraEmpresa,
      distancia: 99999,
    });
    await registrarAvaliacao(pedidoOutraEmpresa.id_pedido, 5);
    await criarPedidoEntrega({
      cpf_entregador: cpfOutroEntregador,
      distancia: 99999,
    });
    for (const statusPedido of [
      StatusPedido.CANCELADO,
      StatusPedido.PENDENTE,
      StatusPedido.EM_ANDAMENTO,
    ]) {
      await criarPedidoEntrega({ status: statusPedido });
    }
    await criarPedidoEntrega({ data_finalizacao: null });
    await criarPedidoEntrega({
      data_finalizacao: new Date('2026-09-30T23:59:59Z'),
    });
    await criarPedidoEntrega({
      data_finalizacao: new Date(periodoConsulta.ate),
    });
    expect(await consultarDesempenho()).toMatchObject({
      total_entregas: 1,
      avaliacao_media: 0,
      total_avaliacoes: 1,
      distancia_total_metros: 1000,
    });
  });

  it('respeita inicio inclusivo, fim exclusivo e fusos equivalentes', async () => {
    await criarPedidoEntrega({
      data_finalizacao: new Date(periodoConsulta.de),
    });
    await criarPedidoEntrega({
      data_finalizacao: new Date('2026-11-01T02:59:59.999Z'),
    });
    await criarPedidoEntrega({
      data_finalizacao: new Date(periodoConsulta.ate),
    });
    await criarPedidoEntrega({
      data_finalizacao: new Date('2026-10-01T02:59:59.999Z'),
    });
    const respostaFusoPositivo = await sessaoEmpresa
      .get(rotaDesempenho)
      .query({
        de: '2026-10-01T05:00:00+02:00',
        ate: '2026-11-01T05:00:00+02:00',
      })
      .expect(200);
    const indicadoresDesempenho = await consultarDesempenho();
    expect(respostaFusoPositivo.body).toEqual(indicadoresDesempenho);
    expect(indicadoresDesempenho.total_entregas).toBe(2);
    const respostaUtc = await sessaoEmpresa
      .get(rotaDesempenho)
      .query({
        de: '2026-10-01T03:00:00Z',
        ate: '2026-11-01T03:00:00Z',
      })
      .expect(200);
    expect(respostaUtc.body).toEqual(indicadoresDesempenho);
  });

  it('exclui tempos ausentes ou inconsistentes e resolve empates pelo ultimo historico', async () => {
    await criarPedidoEntrega();
    const pedidoAtribuicaoFutura = await criarPedidoEntrega();
    await registrarAtribuicao(pedidoAtribuicaoFutura.id_pedido);
    await registrarAtribuicao(
      pedidoAtribuicaoFutura.id_pedido,
      '2026-10-10T12:00:00Z',
    );
    const pedidoAtribuicaoAnteriorCriacao = await criarPedidoEntrega();
    await registrarAtribuicao(
      pedidoAtribuicaoAnteriorCriacao.id_pedido,
      '2026-10-10T08:00:00Z',
    );
    const pedidoEntregadorDivergente = await criarPedidoEntrega();
    await registrarAtribuicao(
      pedidoEntregadorDivergente.id_pedido,
      '2026-10-10T10:00:00Z',
    );
    await registrarAtribuicao(
      pedidoEntregadorDivergente.id_pedido,
      '2026-10-10T10:30:00Z',
      cpfOutroEntregador,
      cpfEntregador,
    );
    const pedidoAtribuicoesSimultaneas = await criarPedidoEntrega();
    await registrarAtribuicao(
      pedidoAtribuicoesSimultaneas.id_pedido,
      '2026-10-10T10:00:00Z',
      cpfOutroEntregador,
    );
    await registrarAtribuicao(
      pedidoAtribuicoesSimultaneas.id_pedido,
      '2026-10-10T10:00:00Z',
      cpfEntregador,
      cpfOutroEntregador,
    );
    expect(await consultarDesempenho()).toMatchObject({
      total_entregas: 5,
      tempo_medio_entrega_segundos: 3600,
      entregas_com_tempo_valido: 1,
      entregas_sem_tempo_valido: 4,
    });
  });

  it('retorna tempo nulo sem historicos validos e aceita duracao zero', async () => {
    await criarPedidoEntrega();
    expect(await consultarDesempenho()).toMatchObject({
      tempo_medio_entrega_segundos: null,
      entregas_sem_tempo_valido: 1,
    });
    const pedidoDuracaoZero = await criarPedidoEntrega();
    await registrarAtribuicao(
      pedidoDuracaoZero.id_pedido,
      '2026-10-10T11:00:00Z',
    );
    expect(await consultarDesempenho()).toMatchObject({
      tempo_medio_entrega_segundos: 0,
      entregas_com_tempo_valido: 1,
    });
  });

  it('preserva soma parcial com distancia desconhecida e legado null, sem exigir ganho', async () => {
    await criarPedidoEntrega({ distancia: 500, distancia_conhecida: true });
    await criarPedidoEntrega({ distancia: 0, distancia_conhecida: true });
    await criarPedidoEntrega({
      distancia: 99999,
      distancia_conhecida: false,
    });
    await criarPedidoEntrega({ distancia: 99999, distancia_conhecida: null });
    expect(await consultarDesempenho()).toMatchObject({
      total_entregas: 4,
      distancia_total_metros: null,
      distancia_conhecida_metros: 500,
      entregas_com_distancia_conhecida: 2,
      entregas_com_distancia_desconhecida: 2,
      avaliacao_media: null,
      total_avaliacoes: 0,
    });
  });

  it('nao inventa soma quando nenhuma distancia e conhecida', async () => {
    await criarPedidoEntrega({ distancia_conhecida: false });
    await criarPedidoEntrega({ distancia_conhecida: null });
    expect(await consultarDesempenho()).toMatchObject({
      distancia_total_metros: null,
      distancia_conhecida_metros: null,
      entregas_com_distancia_conhecida: 0,
      entregas_com_distancia_desconhecida: 2,
    });
  });

  it('retorna indicadores vazios para vinculo ativo mesmo indisponivel', async () => {
    expect(await consultarDesempenho()).toMatchObject({
      total_entregas: 0,
      tempo_medio_entrega_segundos: null,
      entregas_com_tempo_valido: 0,
      entregas_sem_tempo_valido: 0,
      avaliacao_media: null,
      total_avaliacoes: 0,
      distancia_total_metros: 0,
      distancia_conhecida_metros: 0,
      entregas_com_distancia_conhecida: 0,
      entregas_com_distancia_desconhecida: 0,
    });
  });

  it('recusa vinculo ausente, entregador inexistente e contratos inativos com o mesmo 404', async () => {
    const respostaEmpresaSemVinculo = await sessaoOutraEmpresa
      .get(rotaDesempenho)
      .query(periodoConsulta)
      .expect(404);
    const respostaEntregadorInexistente = await sessaoEmpresa
      .get('/entregadores/12345678909/desempenho')
      .query(periodoConsulta)
      .expect(404);
    expect(respostaEntregadorInexistente.body).toEqual(
      respostaEmpresaSemVinculo.body,
    );
    for (const statusContrato of [
      StatusContrato.PENDENTE,
      StatusContrato.RECUSADO,
      StatusContrato.ENCERRADO,
    ]) {
      await clientePrisma.contrato.updateMany({
        data: {
          status: statusContrato,
          data_fim:
            statusContrato === StatusContrato.PENDENTE ? null : new Date(),
        },
      });
      const respostaContratoInativo = await sessaoEmpresa
        .get(rotaDesempenho)
        .query(periodoConsulta)
        .expect(404);
      expect(respostaContratoInativo.body).toEqual(
        respostaEmpresaSemVinculo.body,
      );
    }
  });

  it('exige login e cargo ESTABELECIMENTO com autenticacao e autorizacao reais', async () => {
    await requisicaoHttp(aplicacao.getHttpServer())
      .get(rotaDesempenho)
      .query(periodoConsulta)
      .expect(401);
    await sessaoEntregador
      .get(rotaDesempenho)
      .query(periodoConsulta)
      .expect(403);
  });

  it('rejeita CPF, filtros desconhecidos, datas e intervalos invalidos pela rota de desempenho', async () => {
    await sessaoEmpresa
      .get('/entregadores/00000000000/desempenho')
      .query(periodoConsulta)
      .expect(400);
    const filtrosInvalidos = [
      {},
      { de: periodoConsulta.de },
      { ate: periodoConsulta.ate },
      { ...periodoConsulta, de: '2026-10-01' },
      { ...periodoConsulta, de: '2026-02-30T00:00:00Z' },
      { ...periodoConsulta, de: '2026-10-01T00:00:00' },
      { ...periodoConsulta, ate: periodoConsulta.de },
      { de: periodoConsulta.ate, ate: periodoConsulta.de },
      { ...periodoConsulta, de: [periodoConsulta.de, periodoConsulta.de] },
      {
        ...periodoConsulta,
        ate: [periodoConsulta.ate, periodoConsulta.ate],
      },
      { ...periodoConsulta, idEmpresa: idOutraEmpresa },
    ];
    for (const filtroInvalido of filtrosInvalidos) {
      await sessaoEmpresa.get(rotaDesempenho).query(filtroInvalido).expect(400);
    }
  });
});
