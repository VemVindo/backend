import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import { hash } from 'bcryptjs';
import { Pool } from 'pg';
import requisicao_http from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { Prisma, PrismaClient } from '../src/generated/prisma/client';
import { StatusContrato, StatusPedido } from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';
import { DesempenhoEntregadorDto } from '../src/entregador/dto/desempenho-entregador.dto';

const url_banco_teste = process.env.TEST_DATABASE_URL;
const descrever_integracao = url_banco_teste ? describe : describe.skip;

descrever_integracao('E-US18: endpoint real e agregacoes PostgreSQL', () => {
  const esquema_teste = `eus18_${randomUUID().replaceAll('-', '')}`;
  const cpf_entregador = '52998224725';
  const cpf_outro_entregador = '11144477735';
  const periodo_consulta = {
    de: '2026-10-01T00:00:00-03:00',
    ate: '2026-11-01T00:00:00-03:00',
  };
  const rota_desempenho = `/entregadores/${cpf_entregador}/desempenho`;
  let conexao_administrativa: Pool;
  let conexao_sql: Pool;
  let cliente_prisma: PrismaClient;
  let aplicacao: INestApplication<App>;
  let id_empresa_autenticada: number;
  let id_outra_empresa: number;
  let sessao_empresa: ReturnType<typeof requisicao_http.agent>;
  let sessao_outra_empresa: ReturnType<typeof requisicao_http.agent>;
  let sessao_entregador: ReturnType<typeof requisicao_http.agent>;

  async function criar_pedido_entrega(
    alteracoes_pedido: Partial<Prisma.PedidoUncheckedCreateInput> = {},
  ) {
    return cliente_prisma.pedido.create({
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
        idEmpresa: id_empresa_autenticada,
        cpf_entregador,
        distancia: 1000,
        distancia_conhecida: true,
        ...alteracoes_pedido,
      },
    });
  }

  async function registrar_atribuicao(
    id_pedido: number,
    data_atribuicao = '2026-10-10T10:40:00Z',
    cpf_novo_entregador = cpf_entregador,
    cpf_entregador_anterior: string | null = null,
  ) {
    await cliente_prisma.historicoPedidoEntregadores.create({
      data: {
        id_pedido,
        data: new Date(data_atribuicao),
        cpf_entregador_novo: cpf_novo_entregador,
        cpf_entregador_antigo: cpf_entregador_anterior,
      },
    });
  }

  async function registrar_avaliacao(id_pedido: number, nota: number) {
    await cliente_prisma.avaliacao.create({
      data: {
        idpedidos: id_pedido,
        avaliacao_entrega: nota,
        data: new Date('2026-11-02T00:00:00Z'),
      },
    });
  }

  async function consultar_desempenho() {
    const resposta_desempenho = await sessao_empresa
      .get(rota_desempenho)
      .query(periodo_consulta)
      .expect(200);
    return resposta_desempenho.body as DesempenhoEntregadorDto;
  }

  async function abrir_conexoes_teste() {
    conexao_administrativa = new Pool({
      connectionString: url_banco_teste,
      connectionTimeoutMillis: 5000,
    });
    await conexao_administrativa.query(`CREATE SCHEMA "${esquema_teste}"`);
    conexao_sql = new Pool({
      connectionString: url_banco_teste,
      options: `-c search_path=${esquema_teste}`,
      connectionTimeoutMillis: 5000,
    });
  }

  async function aplicar_migracoes_teste() {
    const pasta_migracoes = join(__dirname, '../prisma/migrations');
    const nomes_migracoes = readdirSync(pasta_migracoes)
      .filter((nome_migracao) => /^\d/.test(nome_migracao))
      .sort();
    for (const nome_migracao of nomes_migracoes) {
      await conexao_sql.query(
        readFileSync(
          join(pasta_migracoes, nome_migracao, 'migration.sql'),
          'utf8',
        ),
      );
    }
  }

  function configurar_cliente_prisma() {
    cliente_prisma = new PrismaClient({
      adapter: new PrismaPg(
        {
          connectionString: url_banco_teste,
          options: `-c search_path=${esquema_teste}`,
        },
        { schema: esquema_teste },
      ),
    });
  }

  async function cadastrar_empresa_teste(
    email_empresa: string,
    senha_criptografada: string,
  ) {
    const empresa_cadastrada = await cliente_prisma.empresa.create({
      data: {
        nome_fantasia: 'E-US18',
        email: email_empresa,
        telefone: '61999999999',
        cep: '70000000',
        logradouro: 'Rua',
        numero: 1,
        bairro: 'Centro',
        cidade: 'Brasilia',
        UF: 'DF',
        senha: senha_criptografada,
      },
    });
    return empresa_cadastrada.id_empresa;
  }

  async function cadastrar_entregadores_teste(senha_criptografada: string) {
    for (const cpf_cadastrado of [cpf_entregador, cpf_outro_entregador]) {
      await cliente_prisma.entregador.create({
        data: {
          cpf: cpf_cadastrado,
          nome: 'Entregador',
          telefone: '61999999999',
          tipo_veiculo: 'MOTO',
          senha: senha_criptografada,
          senha_temporaria: false,
          disponivel: false,
        },
      });
    }
  }

  async function cadastrar_vinculo_ativo() {
    await cliente_prisma.contrato.create({
      data: {
        idEmpresa: id_empresa_autenticada,
        cpf_entregador,
        status: StatusContrato.ATIVO,
        data_inicio: new Date('2026-01-01T00:00:00Z'),
      },
    });
  }

  async function preparar_cadastros_teste() {
    const senha_criptografada = await hash('Vemvindo@123', 4);
    id_empresa_autenticada = await cadastrar_empresa_teste(
      'a@eus18.test',
      senha_criptografada,
    );
    id_outra_empresa = await cadastrar_empresa_teste(
      'b@eus18.test',
      senha_criptografada,
    );
    await cadastrar_entregadores_teste(senha_criptografada);
    await cadastrar_vinculo_ativo();
  }

  async function iniciar_aplicacao_teste() {
    const modulo_teste = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(cliente_prisma)
      .compile();
    aplicacao = modulo_teste.createNestApplication();
    aplicacao.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await aplicacao.init();
  }

  async function autenticar_sessoes_teste() {
    sessao_empresa = requisicao_http.agent(aplicacao.getHttpServer());
    sessao_outra_empresa = requisicao_http.agent(aplicacao.getHttpServer());
    sessao_entregador = requisicao_http.agent(aplicacao.getHttpServer());
    await sessao_empresa
      .post('/auth/login/empresa')
      .send({ email: 'a@eus18.test', senha: 'Vemvindo@123' })
      .expect(200);
    await sessao_outra_empresa
      .post('/auth/login/empresa')
      .send({ email: 'b@eus18.test', senha: 'Vemvindo@123' })
      .expect(200);
    await sessao_entregador
      .post('/auth/login/entregador')
      .send({ cpf: cpf_entregador, senha: 'Vemvindo@123' })
      .expect(200);
  }

  beforeAll(async () => {
    await abrir_conexoes_teste();
    await aplicar_migracoes_teste();
    configurar_cliente_prisma();
    await preparar_cadastros_teste();
    await iniciar_aplicacao_teste();
    await autenticar_sessoes_teste();
  }, 60_000);

  beforeEach(async () => {
    await cliente_prisma.contrato.deleteMany({
      where: { idEmpresa: id_outra_empresa },
    });
    await cliente_prisma.avaliacao.deleteMany();
    await cliente_prisma.historicoPedidoEntregadores.deleteMany();
    await cliente_prisma.pedido.deleteMany();
    await cliente_prisma.contrato.updateMany({
      data: { status: StatusContrato.ATIVO, data_fim: null },
    });
  });

  afterAll(async () => {
    if (aplicacao) await aplicacao.close();
    if (cliente_prisma) await cliente_prisma.$disconnect();
    if (conexao_sql) await conexao_sql.end();
    if (conexao_administrativa) {
      await conexao_administrativa.query(
        `DROP SCHEMA IF EXISTS "${esquema_teste}" CASCADE`,
      );
      await conexao_administrativa.end();
    }
  });

  it('agrega primeira atribuicao, reatribuicao e retorno sem duplicar os indicadores', async () => {
    const pedido_primeira_atribuicao = await criar_pedido_entrega();
    await registrar_atribuicao(pedido_primeira_atribuicao.id_pedido);
    await registrar_avaliacao(pedido_primeira_atribuicao.id_pedido, 0);
    const pedido_reatribuido = await criar_pedido_entrega({ distancia: 2000 });
    await registrar_atribuicao(
      pedido_reatribuido.id_pedido,
      '2026-10-10T09:00:00Z',
      cpf_entregador,
    );
    await registrar_atribuicao(
      pedido_reatribuido.id_pedido,
      '2026-10-10T10:00:00Z',
      cpf_outro_entregador,
      cpf_entregador,
    );
    await registrar_atribuicao(
      pedido_reatribuido.id_pedido,
      '2026-10-10T10:30:00Z',
      cpf_entregador,
      cpf_outro_entregador,
    );
    await registrar_avaliacao(pedido_reatribuido.id_pedido, 5);
    const pedido_sem_avaliacao = await criar_pedido_entrega({ distancia: 0 });
    await registrar_atribuicao(
      pedido_sem_avaliacao.id_pedido,
      '2026-10-10T10:50:00Z',
    );
    expect(await consultar_desempenho()).toEqual({
      cpf_entregador,
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
    await cliente_prisma.contrato.create({
      data: {
        idEmpresa: id_outra_empresa,
        cpf_entregador,
        status: StatusContrato.ATIVO,
        data_inicio: new Date('2026-01-01T00:00:00Z'),
      },
    });
    const pedido_elegivel = await criar_pedido_entrega();
    await registrar_avaliacao(pedido_elegivel.id_pedido, 0);
    const pedido_outra_empresa = await criar_pedido_entrega({
      idEmpresa: id_outra_empresa,
      distancia: 99999,
    });
    await registrar_avaliacao(pedido_outra_empresa.id_pedido, 5);
    await criar_pedido_entrega({
      cpf_entregador: cpf_outro_entregador,
      distancia: 99999,
    });
    for (const status_pedido of [
      StatusPedido.CANCELADO,
      StatusPedido.PENDENTE,
      StatusPedido.EM_ANDAMENTO,
    ]) {
      await criar_pedido_entrega({ status: status_pedido });
    }
    await criar_pedido_entrega({ data_finalizacao: null });
    await criar_pedido_entrega({
      data_finalizacao: new Date('2026-09-30T23:59:59Z'),
    });
    await criar_pedido_entrega({
      data_finalizacao: new Date(periodo_consulta.ate),
    });
    expect(await consultar_desempenho()).toMatchObject({
      total_entregas: 1,
      avaliacao_media: 0,
      total_avaliacoes: 1,
      distancia_total_metros: 1000,
    });
  });

  it('respeita inicio inclusivo, fim exclusivo e fusos equivalentes', async () => {
    await criar_pedido_entrega({
      data_finalizacao: new Date(periodo_consulta.de),
    });
    await criar_pedido_entrega({
      data_finalizacao: new Date('2026-11-01T02:59:59.999Z'),
    });
    await criar_pedido_entrega({
      data_finalizacao: new Date(periodo_consulta.ate),
    });
    await criar_pedido_entrega({
      data_finalizacao: new Date('2026-10-01T02:59:59.999Z'),
    });
    const resposta_fuso_positivo = await sessao_empresa
      .get(rota_desempenho)
      .query({
        de: '2026-10-01T05:00:00+02:00',
        ate: '2026-11-01T05:00:00+02:00',
      })
      .expect(200);
    const indicadores_desempenho = await consultar_desempenho();
    expect(resposta_fuso_positivo.body).toEqual(indicadores_desempenho);
    expect(indicadores_desempenho.total_entregas).toBe(2);
    const resposta_utc = await sessao_empresa
      .get(rota_desempenho)
      .query({
        de: '2026-10-01T03:00:00Z',
        ate: '2026-11-01T03:00:00Z',
      })
      .expect(200);
    expect(resposta_utc.body).toEqual(indicadores_desempenho);
  });

  it('exclui tempos ausentes ou inconsistentes e resolve empates pelo ultimo historico', async () => {
    await criar_pedido_entrega();
    const pedido_atribuicao_futura = await criar_pedido_entrega();
    await registrar_atribuicao(pedido_atribuicao_futura.id_pedido);
    await registrar_atribuicao(
      pedido_atribuicao_futura.id_pedido,
      '2026-10-10T12:00:00Z',
    );
    const pedido_atribuicao_anterior_criacao = await criar_pedido_entrega();
    await registrar_atribuicao(
      pedido_atribuicao_anterior_criacao.id_pedido,
      '2026-10-10T08:00:00Z',
    );
    const pedido_entregador_divergente = await criar_pedido_entrega();
    await registrar_atribuicao(
      pedido_entregador_divergente.id_pedido,
      '2026-10-10T10:00:00Z',
    );
    await registrar_atribuicao(
      pedido_entregador_divergente.id_pedido,
      '2026-10-10T10:30:00Z',
      cpf_outro_entregador,
      cpf_entregador,
    );
    const pedido_atribuicoes_simultaneas = await criar_pedido_entrega();
    await registrar_atribuicao(
      pedido_atribuicoes_simultaneas.id_pedido,
      '2026-10-10T10:00:00Z',
      cpf_outro_entregador,
    );
    await registrar_atribuicao(
      pedido_atribuicoes_simultaneas.id_pedido,
      '2026-10-10T10:00:00Z',
      cpf_entregador,
      cpf_outro_entregador,
    );
    expect(await consultar_desempenho()).toMatchObject({
      total_entregas: 5,
      tempo_medio_entrega_segundos: 3600,
      entregas_com_tempo_valido: 1,
      entregas_sem_tempo_valido: 4,
    });
  });

  it('retorna tempo nulo sem historicos validos e aceita duracao zero', async () => {
    await criar_pedido_entrega();
    expect(await consultar_desempenho()).toMatchObject({
      tempo_medio_entrega_segundos: null,
      entregas_sem_tempo_valido: 1,
    });
    const pedido_duracao_zero = await criar_pedido_entrega();
    await registrar_atribuicao(
      pedido_duracao_zero.id_pedido,
      '2026-10-10T11:00:00Z',
    );
    expect(await consultar_desempenho()).toMatchObject({
      tempo_medio_entrega_segundos: 0,
      entregas_com_tempo_valido: 1,
    });
  });

  it('preserva soma parcial com distancia desconhecida e legado null, sem exigir ganho', async () => {
    await criar_pedido_entrega({ distancia: 500, distancia_conhecida: true });
    await criar_pedido_entrega({ distancia: 0, distancia_conhecida: true });
    await criar_pedido_entrega({
      distancia: 99999,
      distancia_conhecida: false,
    });
    await criar_pedido_entrega({ distancia: 99999, distancia_conhecida: null });
    expect(await consultar_desempenho()).toMatchObject({
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
    await criar_pedido_entrega({ distancia_conhecida: false });
    await criar_pedido_entrega({ distancia_conhecida: null });
    expect(await consultar_desempenho()).toMatchObject({
      distancia_total_metros: null,
      distancia_conhecida_metros: null,
      entregas_com_distancia_conhecida: 0,
      entregas_com_distancia_desconhecida: 2,
    });
  });

  it('retorna indicadores vazios para vinculo ativo mesmo indisponivel', async () => {
    expect(await consultar_desempenho()).toMatchObject({
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
    const resposta_empresa_sem_vinculo = await sessao_outra_empresa
      .get(rota_desempenho)
      .query(periodo_consulta)
      .expect(404);
    const resposta_entregador_inexistente = await sessao_empresa
      .get('/entregadores/12345678909/desempenho')
      .query(periodo_consulta)
      .expect(404);
    expect(resposta_entregador_inexistente.body).toEqual(
      resposta_empresa_sem_vinculo.body,
    );
    for (const status_contrato of [
      StatusContrato.PENDENTE,
      StatusContrato.RECUSADO,
      StatusContrato.ENCERRADO,
    ]) {
      await cliente_prisma.contrato.updateMany({
        data: {
          status: status_contrato,
          data_fim:
            status_contrato === StatusContrato.PENDENTE ? null : new Date(),
        },
      });
      const resposta_contrato_inativo = await sessao_empresa
        .get(rota_desempenho)
        .query(periodo_consulta)
        .expect(404);
      expect(resposta_contrato_inativo.body).toEqual(
        resposta_empresa_sem_vinculo.body,
      );
    }
  });

  it('exige login e cargo ESTABELECIMENTO com autenticacao e autorizacao reais', async () => {
    await requisicao_http(aplicacao.getHttpServer())
      .get(rota_desempenho)
      .query(periodo_consulta)
      .expect(401);
    await sessao_entregador
      .get(rota_desempenho)
      .query(periodo_consulta)
      .expect(403);
  });

  it('rejeita CPF, filtros desconhecidos, datas e intervalos invalidos pela rota de desempenho', async () => {
    await sessao_empresa
      .get('/entregadores/00000000000/desempenho')
      .query(periodo_consulta)
      .expect(400);
    const filtros_invalidos = [
      {},
      { de: periodo_consulta.de },
      { ate: periodo_consulta.ate },
      { ...periodo_consulta, de: '2026-10-01' },
      { ...periodo_consulta, de: '2026-02-30T00:00:00Z' },
      { ...periodo_consulta, de: '2026-10-01T00:00:00' },
      { ...periodo_consulta, ate: periodo_consulta.de },
      { de: periodo_consulta.ate, ate: periodo_consulta.de },
      { ...periodo_consulta, de: [periodo_consulta.de, periodo_consulta.de] },
      {
        ...periodo_consulta,
        ate: [periodo_consulta.ate, periodo_consulta.ate],
      },
      { ...periodo_consulta, idEmpresa: id_outra_empresa },
    ];
    for (const filtro_invalido of filtros_invalidos) {
      await sessao_empresa
        .get(rota_desempenho)
        .query(filtro_invalido)
        .expect(400);
    }
  });
});
