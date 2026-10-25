import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { StatusPedido } from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';
import { PedidoRepository } from '../src/pedido/pedido.repository';
import { PedidoAlteradoError } from '../src/pedido/pedido.erros';
import { CriaPedidoReqDto } from '../src/pedido/dto/cria-pedido.dto';
import { RemuneracaoRepository } from '../src/remuneracao/remuneracao.repository';
import { GanhoEntregaService } from '../src/remuneracao/ganho-entrega.service';
import { CalculoValorEntregaService } from '../src/remuneracao/calculo-valor-entrega.service';

const TEMPO_LIMITE_CONEXAO_MS = 5_000;
const TEMPO_LIMITE_PREPARACAO_MS = 60_000;
const MIGRACAO_GANHOS = '20261024000000_ganhos_por_entrega';
const url_banco_teste = process.env.TEST_DATABASE_URL;
const descrever_integracao = url_banco_teste ? describe : describe.skip;

descrever_integracao('E-US16 PostgreSQL: transacoes reais e migration', () => {
  const pasta_migracoes = join(__dirname, '../prisma/migrations');
  const esquema_teste = `eus16_${randomUUID().replaceAll('-', '')}`;
  let conexao_administrativa: Pool;
  let conexao_sql: Pool;
  let cliente_prisma: PrismaClient;
  let repositorio_pedidos: PedidoRepository;
  let repositorio_remuneracao: RemuneracaoRepository;
  let id_empresa_a: number;
  let id_empresa_b: number;
  let id_pedido_legado: number;
  const cpf_entregador_a = '52998224725';
  const cpf_entregador_b = '11144477735';
  const inicio_vigencia_original = new Date('2020-01-01T00:00:00Z');

  const criar_dados_pedido = (cpf?: string): CriaPedidoReqDto =>
    ({
      nome_recebedor: 'Teste E-US16',
      telefone_recebedor: '61999999999',
      cep: '70000000',
      logradouro: 'Rua',
      numero: 1,
      bairro: 'Centro',
      cidade: 'Brasilia',
      uf: 'DF',
      descricao: 'Entrega de teste',
      status: cpf ? StatusPedido.EM_ANDAMENTO : StatusPedido.PENDENTE,
      data_criacao: new Date().toISOString(),
      distancia: 4200,
      valor_entrega: 123,
      cpf_entregador: cpf,
    }) as CriaPedidoReqDto;
  const finalizar_pedido = (
    id_pedido: number,
    cpf_entregador = cpf_entregador_a,
  ) =>
    repositorio_pedidos.atualizarStatus({
      idPedido: id_pedido,
      cpfEntregador: cpf_entregador,
      statusAtual: StatusPedido.EM_ANDAMENTO,
      novoStatus: StatusPedido.FINALIZADO,
      finalizar: true,
    });
  const criar_pedido_atribuido = () =>
    repositorio_pedidos.criar(
      criar_dados_pedido(cpf_entregador_a),
      id_empresa_a,
    );

  async function abrir_conexoes_teste() {
    conexao_administrativa = new Pool({
      connectionString: url_banco_teste,
      connectionTimeoutMillis: TEMPO_LIMITE_CONEXAO_MS,
    });
    await conexao_administrativa.query(`CREATE SCHEMA "${esquema_teste}"`);
    conexao_sql = new Pool({
      connectionString: url_banco_teste,
      options: `-c search_path=${esquema_teste}`,
      connectionTimeoutMillis: TEMPO_LIMITE_CONEXAO_MS,
    });
  }

  async function aplicar_migracoes_anteriores() {
    const nomes_migracoes = readdirSync(pasta_migracoes)
      .filter((nome) => /^\d/.test(nome))
      .sort();
    for (const nome of nomes_migracoes.filter(
      (nome) => nome !== MIGRACAO_GANHOS,
    )) {
      await conexao_sql.query(
        readFileSync(join(pasta_migracoes, nome, 'migration.sql'), 'utf8'),
      );
    }
  }

  async function cadastrar_pedido_legado() {
    const resultado_empresa_a = await conexao_sql.query<{
      id_empresa: number;
    }>(`INSERT INTO "Empresa" (nome_fantasia,email,telefone,cep,logradouro,numero,bairro,cidade,"UF",senha)
      VALUES ('A','a@eus16.test','61999999999','70000000','Rua',1,'Centro','Brasilia','DF','teste') RETURNING id_empresa`);
    id_empresa_a = resultado_empresa_a.rows[0].id_empresa;
    const resultado_pedido_legado = await conexao_sql.query<{
      id_pedido: number;
    }>(
      `INSERT INTO "Pedido" (nome_recebedor,telefone_recebedor,cep,logradouro,numero,bairro,cidade,uf,descricao,status,data_criacao,data_finalizacao,valor_entrega,"idEmpresa",distancia)
      VALUES ('Legado','61999999999','70000000','Rua',1,'Centro','Brasilia','DF','Legado','FINALIZADO',NOW(),NOW(),321,$1,0) RETURNING id_pedido`,
      [id_empresa_a],
    );
    id_pedido_legado = resultado_pedido_legado.rows[0].id_pedido;
  }

  async function aplicar_migracao_ganhos() {
    await conexao_sql.query(
      readFileSync(
        join(pasta_migracoes, MIGRACAO_GANHOS, 'migration.sql'),
        'utf8',
      ),
    );
  }

  function configurar_repositorios() {
    cliente_prisma = new PrismaClient({
      adapter: new PrismaPg(
        {
          connectionString: url_banco_teste,
          options: `-c search_path=${esquema_teste}`,
        },
        { schema: esquema_teste },
      ),
    });
    const cliente_repositorios = cliente_prisma as unknown as PrismaService;
    repositorio_remuneracao = new RemuneracaoRepository(cliente_repositorios);
    repositorio_pedidos = new PedidoRepository(
      cliente_repositorios,
      new GanhoEntregaService(
        repositorio_remuneracao,
        new CalculoValorEntregaService(),
      ),
    );
  }

  async function cadastrar_empresa_b() {
    const empresa_a = await cliente_prisma.empresa.findUniqueOrThrow({
      where: { id_empresa: id_empresa_a },
    });
    const dados_empresa_b = { ...empresa_a, id_empresa: undefined };
    id_empresa_b = (
      await cliente_prisma.empresa.create({
        data: { ...dados_empresa_b, nome_fantasia: 'B', email: 'b@eus16.test' },
      })
    ).id_empresa;
  }

  async function cadastrar_entregadores_e_contratos() {
    for (const cpf of [cpf_entregador_a, cpf_entregador_b]) {
      await cliente_prisma.entregador.create({
        data: {
          cpf,
          nome: 'Entregador',
          telefone: '61999999999',
          tipo_veiculo: 'MOTO',
          senha: 'teste',
        },
      });
      for (const id_empresa of [id_empresa_a, id_empresa_b]) {
        await cliente_prisma.contrato.create({
          data: {
            cpf_entregador: cpf,
            idEmpresa: id_empresa,
            status: 'ATIVO',
            data_inicio: inicio_vigencia_original,
          },
        });
      }
    }
  }

  async function configurar_parametros_iniciais() {
    await repositorio_remuneracao.registrar(
      id_empresa_a,
      { taxaFixa: 800, coeficienteKm: 150 },
      inicio_vigencia_original,
    );
    await repositorio_remuneracao.registrar(
      id_empresa_b,
      { taxaFixa: 200, coeficienteKm: 100 },
      inicio_vigencia_original,
    );
  }

  beforeAll(async () => {
    await abrir_conexoes_teste();
    await aplicar_migracoes_anteriores();
    await cadastrar_pedido_legado();
    await aplicar_migracao_ganhos();
    configurar_repositorios();
    await cadastrar_empresa_b();
    await cadastrar_entregadores_e_contratos();
    await configurar_parametros_iniciais();
  }, TEMPO_LIMITE_PREPARACAO_MS);

  beforeEach(async () => {
    await cliente_prisma.historicoPedidoEntregadores.deleteMany();
    await cliente_prisma.pedido.deleteMany({
      where: { id_pedido: { not: id_pedido_legado } },
    });
    await cliente_prisma.entregador.updateMany({ data: { disponivel: true } });
    await cliente_prisma.metricasPagamento.deleteMany({
      where: { data: { not: inicio_vigencia_original } },
    });
  });

  afterAll(async () => {
    await cliente_prisma?.$disconnect();
    await conexao_sql?.end();
    if (conexao_administrativa) {
      await conexao_administrativa.query(
        `DROP SCHEMA IF EXISTS "${esquema_teste}" CASCADE`,
      );
      await conexao_administrativa.end();
    }
  });

  it('migration preserva pedido finalizado legado sem inferir distancia ou ganho', async () => {
    expect(
      await cliente_prisma.pedido.findUniqueOrThrow({
        where: { id_pedido: id_pedido_legado },
      }),
    ).toMatchObject({
      valor_entrega: 321,
      distancia: 0,
      distancia_conhecida: null,
      ganho_consolidado_centavos: null,
      taxa_fixa_atribuicao_centavos: null,
    });
    await expect(finalizar_pedido(id_pedido_legado)).rejects.toBeInstanceOf(
      PedidoAlteradoError,
    );
    await expect(
      conexao_sql.query(
        'UPDATE "Pedido" SET ganho_consolidado_centavos = 0 WHERE id_pedido = $1',
        [id_pedido_legado],
      ),
    ).rejects.toMatchObject({
      code: '23514',
      constraint: 'Pedido_ganho_consolidado_valido',
    });
    await validar_restricao_ganho_consolidado();
  });

  async function validar_restricao_ganho_consolidado() {
    const pedido = await criar_pedido_atribuido();
    await finalizar_pedido(pedido.id_pedido);
    const alteracoes_invalidas: [string, string | number | boolean | null][] = [
      ['ganho_consolidado_centavos', -1],
      ['status', StatusPedido.EM_ANDAMENTO],
      ['data_finalizacao', null],
      ['cpf_entregador', null],
      ['distancia_conhecida', false],
      ['distancia_conhecida', null],
      ['distancia', -1],
      ['taxa_fixa_atribuicao_centavos', null],
      ['taxa_fixa_atribuicao_centavos', -1],
      ['coeficiente_atribuicao_centavos_km', null],
      ['coeficiente_atribuicao_centavos_km', -1],
      ['parametros_vigentes_desde', null],
      ['remuneracao_atribuida_em', null],
    ];
    for (const [coluna, valor_invalido] of alteracoes_invalidas) {
      await expect(
        conexao_sql.query(
          `UPDATE "Pedido" SET "${coluna}" = $1 WHERE id_pedido = $2`,
          [valor_invalido, pedido.id_pedido],
        ),
      ).rejects.toMatchObject({
        code: '23514',
        constraint: 'Pedido_ganho_consolidado_valido',
      });
    }
    expect(
      (
        await cliente_prisma.pedido.findUniqueOrThrow({
          where: { id_pedido: pedido.id_pedido },
        })
      ).ganho_consolidado_centavos,
    ).toBe(1430);
  }

  it('duas conclusoes simultaneas consolidam uma unica vez', async () => {
    const pedido = await criar_pedido_atribuido();
    const resultados = await Promise.allSettled([
      finalizar_pedido(pedido.id_pedido),
      finalizar_pedido(pedido.id_pedido),
    ]);
    expect(
      resultados.filter((resultado) => resultado.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      resultados.filter((resultado) => resultado.status === 'rejected'),
    ).toHaveLength(1);
    expect(
      await cliente_prisma.pedido.findUniqueOrThrow({
        where: { id_pedido: pedido.id_pedido },
      }),
    ).toMatchObject({
      status: 'FINALIZADO',
      ganho_consolidado_centavos: 1430,
      valor_entrega: 123,
    });
  });

  it('conclusao e reatribuicao concorrentes nao usam snapshot de outro entregador', async () => {
    const pedido = await criar_pedido_atribuido();
    const resultados = await Promise.allSettled([
      finalizar_pedido(pedido.id_pedido),
      repositorio_pedidos.reatribuir({
        idPedido: pedido.id_pedido,
        cpfAnterior: cpf_entregador_a,
        cpfNovo: cpf_entregador_b,
        statusAtual: StatusPedido.EM_ANDAMENTO,
      }),
    ]);
    expect(
      resultados.filter((resultado) => resultado.status === 'fulfilled'),
    ).toHaveLength(1);
    const pedido_persistido = await cliente_prisma.pedido.findUniqueOrThrow({
      where: { id_pedido: pedido.id_pedido },
    });
    if (pedido_persistido.status === StatusPedido.FINALIZADO) {
      expect(pedido_persistido).toMatchObject({
        cpf_entregador: cpf_entregador_a,
        ganho_consolidado_centavos: 1430,
      });
    } else {
      expect(pedido_persistido).toMatchObject({
        cpf_entregador: cpf_entregador_b,
        ganho_consolidado_centavos: null,
      });
      await expect(finalizar_pedido(pedido.id_pedido)).rejects.toBeInstanceOf(
        PedidoAlteradoError,
      );
      expect(
        (await finalizar_pedido(pedido.id_pedido, cpf_entregador_b))
          .ganho_consolidado_centavos,
      ).toBe(1430);
    }
  });

  it('falha depois da escrita do ganho desfaz status, valor, data e disponibilidade', async () => {
    const pedido = await criar_pedido_atribuido();
    await conexao_sql.query(
      `CREATE FUNCTION falhar_liberacao() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'falha teste rollback'; END $$`,
    );
    await conexao_sql.query(
      `CREATE TRIGGER falhar_liberacao BEFORE UPDATE ON "Entregador" FOR EACH ROW EXECUTE FUNCTION falhar_liberacao()`,
    );
    try {
      await expect(finalizar_pedido(pedido.id_pedido)).rejects.toThrow();
      expect(
        await cliente_prisma.pedido.findUniqueOrThrow({
          where: { id_pedido: pedido.id_pedido },
        }),
      ).toMatchObject({
        status: 'EM_ANDAMENTO',
        data_finalizacao: null,
        ganho_consolidado_centavos: null,
      });
      expect(
        (
          await cliente_prisma.entregador.findUniqueOrThrow({
            where: { cpf: cpf_entregador_a },
          })
        ).disponivel,
      ).toBe(false);
    } finally {
      await conexao_sql.query(`DROP TRIGGER falhar_liberacao ON "Entregador"`);
      await conexao_sql.query(`DROP FUNCTION falhar_liberacao()`);
    }
  });

  it('mudancas na E-US15 apos atribuicao e conclusao preservam o ganho', async () => {
    const pedido = await criar_pedido_atribuido();
    await repositorio_remuneracao.registrar(
      id_empresa_a,
      { taxaFixa: 9999, coeficienteKm: 900 },
      new Date(),
    );
    expect(
      (await finalizar_pedido(pedido.id_pedido)).ganho_consolidado_centavos,
    ).toBe(1430);
    await repositorio_remuneracao.registrar(
      id_empresa_a,
      { taxaFixa: 1, coeficienteKm: 0 },
      new Date(Date.now() + 1),
    );
    await expect(finalizar_pedido(pedido.id_pedido)).rejects.toBeInstanceOf(
      PedidoAlteradoError,
    );
    expect(
      (
        await cliente_prisma.pedido.findUniqueOrThrow({
          where: { id_pedido: pedido.id_pedido },
        })
      ).ganho_consolidado_centavos,
    ).toBe(1430);
  });

  it('mesmo entregador em duas empresas usa apenas os parametros de cada pedido', async () => {
    const pedido_empresa_a = await criar_pedido_atribuido();
    expect(
      (await finalizar_pedido(pedido_empresa_a.id_pedido))
        .ganho_consolidado_centavos,
    ).toBe(1430);
    const pedido_empresa_b = await repositorio_pedidos.criar(
      criar_dados_pedido(cpf_entregador_a),
      id_empresa_b,
    );
    expect(pedido_empresa_b).toMatchObject({
      taxa_fixa_atribuicao_centavos: 200,
      coeficiente_atribuicao_centavos_km: 100,
    });
    expect(
      (await finalizar_pedido(pedido_empresa_b.id_pedido))
        .ganho_consolidado_centavos,
    ).toBe(620);
  });

  it('outro entregador nao consegue concluir', async () => {
    const pedido = await criar_pedido_atribuido();
    await expect(
      finalizar_pedido(pedido.id_pedido, cpf_entregador_b),
    ).rejects.toBeInstanceOf(PedidoAlteradoError);
    expect(
      (
        await cliente_prisma.pedido.findUniqueOrThrow({
          where: { id_pedido: pedido.id_pedido },
        })
      ).ganho_consolidado_centavos,
    ).toBeNull();
  });

  it('snapshot persiste e reatribuicao substitui os parametros anteriores', async () => {
    const pedido = await criar_pedido_atribuido();
    await repositorio_remuneracao.registrar(
      id_empresa_a,
      { taxaFixa: 950, coeficienteKm: 200 },
      new Date(),
    );
    await repositorio_pedidos.reatribuir({
      idPedido: pedido.id_pedido,
      cpfAnterior: cpf_entregador_a,
      cpfNovo: cpf_entregador_b,
      statusAtual: StatusPedido.EM_ANDAMENTO,
    });
    const pedido_persistido = await cliente_prisma.pedido.findUniqueOrThrow({
      where: { id_pedido: pedido.id_pedido },
    });
    expect(pedido_persistido).toMatchObject({
      taxa_fixa_atribuicao_centavos: 950,
      coeficiente_atribuicao_centavos_km: 200,
    });
    expect(
      pedido_persistido.remuneracao_atribuida_em!.getTime(),
    ).toBeGreaterThanOrEqual(pedido.remuneracao_atribuida_em!.getTime());
    expect(
      (await finalizar_pedido(pedido.id_pedido, cpf_entregador_b))
        .ganho_consolidado_centavos,
    ).toBe(1790);
  });

  it('consulta de vigencia inclui data exata e ignora parametros futuros', async () => {
    const instante = new Date('2026-10-01T12:00:00Z');
    await repositorio_remuneracao.registrar(
      id_empresa_a,
      { taxaFixa: 900, coeficienteKm: 180 },
      instante,
    );
    await repositorio_remuneracao.registrar(
      id_empresa_a,
      { taxaFixa: 1, coeficienteKm: 0 },
      new Date('2099-01-01T00:00:00Z'),
    );
    expect(
      await repositorio_remuneracao.procurarVigentes(id_empresa_a, instante),
    ).toMatchObject({
      taxa_fixa: 900,
      coeficiente: 180,
      data: instante,
    });
  });

  it('atribuicao sem parametros faz rollback e nao aproveita os de outra empresa', async () => {
    await cliente_prisma.metricasPagamento.deleteMany({
      where: { idEmpresa: id_empresa_b },
    });
    try {
      await expect(
        repositorio_pedidos.criar(
          criar_dados_pedido(cpf_entregador_a),
          id_empresa_b,
        ),
      ).rejects.toThrow('Configure os parâmetros');
      expect(
        await cliente_prisma.pedido.count({
          where: { idEmpresa: id_empresa_b },
        }),
      ).toBe(0);
      expect(
        (
          await cliente_prisma.entregador.findUniqueOrThrow({
            where: { cpf: cpf_entregador_a },
          })
        ).disponivel,
      ).toBe(true);
    } finally {
      await repositorio_remuneracao.registrar(
        id_empresa_b,
        { taxaFixa: 200, coeficienteKm: 100 },
        inicio_vigencia_original,
      );
    }
  });

  it('distancia desconhecida bloqueia conclusao sem atualizacao parcial', async () => {
    const pedido = await criar_pedido_atribuido();
    await cliente_prisma.pedido.update({
      where: { id_pedido: pedido.id_pedido },
      data: { distancia: 0, distancia_conhecida: false },
    });
    await expect(finalizar_pedido(pedido.id_pedido)).rejects.toThrow(
      'Distância',
    );
    expect(
      await cliente_prisma.pedido.findUniqueOrThrow({
        where: { id_pedido: pedido.id_pedido },
      }),
    ).toMatchObject({
      status: 'EM_ANDAMENTO',
      data_finalizacao: null,
      ganho_consolidado_centavos: null,
    });
    await repositorio_pedidos.corrigir_distancia(
      pedido.id_pedido,
      id_empresa_a,
      0,
    );
    expect(
      (await finalizar_pedido(pedido.id_pedido)).ganho_consolidado_centavos,
    ).toBe(800);
    await expect(
      repositorio_pedidos.corrigir_distancia(
        pedido.id_pedido,
        id_empresa_a,
        4200,
      ),
    ).rejects.toBeInstanceOf(PedidoAlteradoError);
  });

  it('correcao de distancia respeita isolamento entre empresas', async () => {
    const pedido = await criar_pedido_atribuido();
    await expect(
      repositorio_pedidos.corrigir_distancia(pedido.id_pedido, id_empresa_b, 0),
    ).rejects.toBeInstanceOf(PedidoAlteradoError);
    expect(
      (
        await cliente_prisma.pedido.findUniqueOrThrow({
          where: { id_pedido: pedido.id_pedido },
        })
      ).distancia,
    ).toBe(4200);
  });
});
