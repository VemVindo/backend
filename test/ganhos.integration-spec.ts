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
import { CriarPedidoDto } from '../src/pedido/dto/criar-pedido.dto';
import { RemuneracaoRepository } from '../src/remuneracao/remuneracao.repository';
import { GanhoEntregaService } from '../src/remuneracao/ganho-entrega.service';
import { CalculoValorEntregaService } from '../src/remuneracao/calculo-valor-entrega.service';

const TEMPO_LIMITE_CONEXAO_MS = 5_000;
const TEMPO_LIMITE_PREPARACAO_MS = 60_000;
const MIGRACAO_GANHOS = '20261024000000_ganhos_por_entrega';
const urlBancoTeste = process.env.TEST_DATABASE_URL;
const descreverIntegracao = urlBancoTeste ? describe : describe.skip;

descreverIntegracao('E-US16 PostgreSQL: transacoes reais e migration', () => {
  const pastaMigracoes = join(__dirname, '../prisma/migrations');
  const esquemaTeste = `eus16_${randomUUID().replaceAll('-', '')}`;
  let conexaoAdministrativa: Pool;
  let conexaoSql: Pool;
  let clientePrisma: PrismaClient;
  let repositorioPedidos: PedidoRepository;
  let repositorioRemuneracao: RemuneracaoRepository;
  let idEmpresaA: number;
  let idEmpresaB: number;
  let idPedidoLegado: number;
  const cpfEntregadorA = '52998224725';
  const cpfEntregadorB = '11144477735';
  const inicioVigenciaOriginal = new Date('2020-01-01T00:00:00Z');

  const criarDadosPedido = (cpf?: string): CriarPedidoDto =>
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
    }) as CriarPedidoDto;
  const finalizarPedido = (idPedido: number, cpfEntregador = cpfEntregadorA) =>
    repositorioPedidos.atualizarStatus({
      idPedido,
      cpfEntregador,
      statusAtual: StatusPedido.EM_ANDAMENTO,
      novoStatus: StatusPedido.FINALIZADO,
      finalizar: true,
    });
  const criarPedidoAtribuido = () =>
    repositorioPedidos.criar(criarDadosPedido(cpfEntregadorA), idEmpresaA);

  async function abrirConexoesTeste() {
    conexaoAdministrativa = new Pool({
      connectionString: urlBancoTeste,
      connectionTimeoutMillis: TEMPO_LIMITE_CONEXAO_MS,
    });
    await conexaoAdministrativa.query(`CREATE SCHEMA "${esquemaTeste}"`);
    conexaoSql = new Pool({
      connectionString: urlBancoTeste,
      options: `-c search_path=${esquemaTeste}`,
      connectionTimeoutMillis: TEMPO_LIMITE_CONEXAO_MS,
    });
  }

  async function aplicarMigracoesAnteriores() {
    const nomesMigracoes = readdirSync(pastaMigracoes)
      .filter((nome) => /^\d/.test(nome))
      .sort();
    for (const nome of nomesMigracoes.filter(
      (nome) => nome !== MIGRACAO_GANHOS,
    )) {
      await conexaoSql.query(
        readFileSync(join(pastaMigracoes, nome, 'migration.sql'), 'utf8'),
      );
    }
  }

  async function cadastrarPedidoLegado() {
    const resultadoEmpresaA = await conexaoSql.query<{
      id_empresa: number;
    }>(`INSERT INTO "Empresa" (nome_fantasia,email,telefone,cep,logradouro,numero,bairro,cidade,"UF",senha)
      VALUES ('A','a@eus16.test','61999999999','70000000','Rua',1,'Centro','Brasilia','DF','teste') RETURNING id_empresa`);
    idEmpresaA = resultadoEmpresaA.rows[0].id_empresa;
    const resultadoPedidoLegado = await conexaoSql.query<{
      id_pedido: number;
    }>(
      `INSERT INTO "Pedido" (nome_recebedor,telefone_recebedor,cep,logradouro,numero,bairro,cidade,uf,descricao,status,data_criacao,data_finalizacao,valor_entrega,"idEmpresa",distancia)
      VALUES ('Legado','61999999999','70000000','Rua',1,'Centro','Brasilia','DF','Legado','FINALIZADO',NOW(),NOW(),321,$1,0) RETURNING id_pedido`,
      [idEmpresaA],
    );
    idPedidoLegado = resultadoPedidoLegado.rows[0].id_pedido;
  }

  async function aplicarMigracaoGanhos() {
    await conexaoSql.query(
      readFileSync(
        join(pastaMigracoes, MIGRACAO_GANHOS, 'migration.sql'),
        'utf8',
      ),
    );
  }

  function configurarRepositorios() {
    clientePrisma = new PrismaClient({
      adapter: new PrismaPg(
        {
          connectionString: urlBancoTeste,
          options: `-c search_path=${esquemaTeste}`,
        },
        { schema: esquemaTeste },
      ),
    });
    const clienteRepositorios = clientePrisma as unknown as PrismaService;
    repositorioRemuneracao = new RemuneracaoRepository(clienteRepositorios);
    repositorioPedidos = new PedidoRepository(
      clienteRepositorios,
      new GanhoEntregaService(
        repositorioRemuneracao,
        new CalculoValorEntregaService(),
      ),
    );
  }

  async function cadastrarEmpresaB() {
    const empresaA = await clientePrisma.empresa.findUniqueOrThrow({
      where: { id_empresa: idEmpresaA },
    });
    const dadosEmpresaB = { ...empresaA, id_empresa: undefined };
    idEmpresaB = (
      await clientePrisma.empresa.create({
        data: { ...dadosEmpresaB, nome_fantasia: 'B', email: 'b@eus16.test' },
      })
    ).id_empresa;
  }

  async function cadastrarEntregadoresEContratos() {
    for (const cpf of [cpfEntregadorA, cpfEntregadorB]) {
      await clientePrisma.entregador.create({
        data: {
          cpf,
          nome: 'Entregador',
          telefone: '61999999999',
          tipo_veiculo: 'MOTO',
          senha: 'teste',
        },
      });
      for (const idEmpresa of [idEmpresaA, idEmpresaB]) {
        await clientePrisma.contrato.create({
          data: {
            cpf_entregador: cpf,
            idEmpresa,
            status: 'ATIVO',
            data_inicio: inicioVigenciaOriginal,
          },
        });
      }
    }
  }

  async function configurarParametrosIniciais() {
    await repositorioRemuneracao.registrar(
      idEmpresaA,
      { taxaFixa: 800, coeficienteKm: 150 },
      inicioVigenciaOriginal,
    );
    await repositorioRemuneracao.registrar(
      idEmpresaB,
      { taxaFixa: 200, coeficienteKm: 100 },
      inicioVigenciaOriginal,
    );
  }

  beforeAll(async () => {
    await abrirConexoesTeste();
    await aplicarMigracoesAnteriores();
    await cadastrarPedidoLegado();
    await aplicarMigracaoGanhos();
    configurarRepositorios();
    await cadastrarEmpresaB();
    await cadastrarEntregadoresEContratos();
    await configurarParametrosIniciais();
  }, TEMPO_LIMITE_PREPARACAO_MS);

  beforeEach(async () => {
    await clientePrisma.historicoPedidoEntregadores.deleteMany();
    await clientePrisma.pedido.deleteMany({
      where: { id_pedido: { not: idPedidoLegado } },
    });
    await clientePrisma.entregador.updateMany({ data: { disponivel: true } });
    await clientePrisma.metricasPagamento.deleteMany({
      where: { data: { not: inicioVigenciaOriginal } },
    });
  });

  afterAll(async () => {
    await clientePrisma?.$disconnect();
    await conexaoSql?.end();
    if (conexaoAdministrativa) {
      await conexaoAdministrativa.query(
        `DROP SCHEMA IF EXISTS "${esquemaTeste}" CASCADE`,
      );
      await conexaoAdministrativa.end();
    }
  });

  it('migration preserva pedido finalizado legado sem inferir distancia ou ganho', async () => {
    expect(
      await clientePrisma.pedido.findUniqueOrThrow({
        where: { id_pedido: idPedidoLegado },
      }),
    ).toMatchObject({
      valor_entrega: 321,
      distancia: 0,
      distancia_conhecida: null,
      ganho_consolidado_centavos: null,
      taxa_fixa_atribuicao_centavos: null,
    });
    await expect(finalizarPedido(idPedidoLegado)).rejects.toBeInstanceOf(
      PedidoAlteradoError,
    );
    await expect(
      conexaoSql.query(
        'UPDATE "Pedido" SET ganho_consolidado_centavos = 0 WHERE id_pedido = $1',
        [idPedidoLegado],
      ),
    ).rejects.toMatchObject({
      code: '23514',
      constraint: 'Pedido_ganho_consolidado_valido',
    });
    await validarRestricaoGanhoConsolidado();
  });

  async function validarRestricaoGanhoConsolidado() {
    const pedido = await criarPedidoAtribuido();
    await finalizarPedido(pedido.id_pedido);
    const alteracoesInvalidas: [string, string | number | boolean | null][] = [
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
    for (const [coluna, valorInvalido] of alteracoesInvalidas) {
      await expect(
        conexaoSql.query(
          `UPDATE "Pedido" SET "${coluna}" = $1 WHERE id_pedido = $2`,
          [valorInvalido, pedido.id_pedido],
        ),
      ).rejects.toMatchObject({
        code: '23514',
        constraint: 'Pedido_ganho_consolidado_valido',
      });
    }
    expect(
      (
        await clientePrisma.pedido.findUniqueOrThrow({
          where: { id_pedido: pedido.id_pedido },
        })
      ).ganho_consolidado_centavos,
    ).toBe(1430);
  }

  it('duas conclusoes simultaneas consolidam uma unica vez', async () => {
    const pedido = await criarPedidoAtribuido();
    const resultados = await Promise.allSettled([
      finalizarPedido(pedido.id_pedido),
      finalizarPedido(pedido.id_pedido),
    ]);
    expect(
      resultados.filter((resultado) => resultado.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      resultados.filter((resultado) => resultado.status === 'rejected'),
    ).toHaveLength(1);
    expect(
      await clientePrisma.pedido.findUniqueOrThrow({
        where: { id_pedido: pedido.id_pedido },
      }),
    ).toMatchObject({
      status: 'FINALIZADO',
      ganho_consolidado_centavos: 1430,
      valor_entrega: 123,
    });
  });

  it('conclusao e reatribuicao concorrentes nao usam snapshot de outro entregador', async () => {
    const pedido = await criarPedidoAtribuido();
    const resultados = await Promise.allSettled([
      finalizarPedido(pedido.id_pedido),
      repositorioPedidos.reatribuir({
        idPedido: pedido.id_pedido,
        cpfAnterior: cpfEntregadorA,
        cpfNovo: cpfEntregadorB,
        statusAtual: StatusPedido.EM_ANDAMENTO,
      }),
    ]);
    expect(
      resultados.filter((resultado) => resultado.status === 'fulfilled'),
    ).toHaveLength(1);
    const pedidoPersistido = await clientePrisma.pedido.findUniqueOrThrow({
      where: { id_pedido: pedido.id_pedido },
    });
    if (pedidoPersistido.status === StatusPedido.FINALIZADO) {
      expect(pedidoPersistido).toMatchObject({
        cpf_entregador: cpfEntregadorA,
        ganho_consolidado_centavos: 1430,
      });
    } else {
      expect(pedidoPersistido).toMatchObject({
        cpf_entregador: cpfEntregadorB,
        ganho_consolidado_centavos: null,
      });
      await expect(finalizarPedido(pedido.id_pedido)).rejects.toBeInstanceOf(
        PedidoAlteradoError,
      );
      expect(
        (await finalizarPedido(pedido.id_pedido, cpfEntregadorB))
          .ganho_consolidado_centavos,
      ).toBe(1430);
    }
  });

  it('falha depois da escrita do ganho desfaz status, valor, data e disponibilidade', async () => {
    const pedido = await criarPedidoAtribuido();
    await conexaoSql.query(
      `CREATE FUNCTION falhar_liberacao() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'falha teste rollback'; END $$`,
    );
    await conexaoSql.query(
      `CREATE TRIGGER falhar_liberacao BEFORE UPDATE ON "Entregador" FOR EACH ROW EXECUTE FUNCTION falhar_liberacao()`,
    );
    try {
      await expect(finalizarPedido(pedido.id_pedido)).rejects.toThrow();
      expect(
        await clientePrisma.pedido.findUniqueOrThrow({
          where: { id_pedido: pedido.id_pedido },
        }),
      ).toMatchObject({
        status: 'EM_ANDAMENTO',
        data_finalizacao: null,
        ganho_consolidado_centavos: null,
      });
      expect(
        (
          await clientePrisma.entregador.findUniqueOrThrow({
            where: { cpf: cpfEntregadorA },
          })
        ).disponivel,
      ).toBe(false);
    } finally {
      await conexaoSql.query(`DROP TRIGGER falhar_liberacao ON "Entregador"`);
      await conexaoSql.query(`DROP FUNCTION falhar_liberacao()`);
    }
  });

  it('mudancas na E-US15 apos atribuicao e conclusao preservam o ganho', async () => {
    const pedido = await criarPedidoAtribuido();
    await repositorioRemuneracao.registrar(
      idEmpresaA,
      { taxaFixa: 9999, coeficienteKm: 900 },
      new Date(),
    );
    expect(
      (await finalizarPedido(pedido.id_pedido)).ganho_consolidado_centavos,
    ).toBe(1430);
    await repositorioRemuneracao.registrar(
      idEmpresaA,
      { taxaFixa: 1, coeficienteKm: 0 },
      new Date(Date.now() + 1),
    );
    await expect(finalizarPedido(pedido.id_pedido)).rejects.toBeInstanceOf(
      PedidoAlteradoError,
    );
    expect(
      (
        await clientePrisma.pedido.findUniqueOrThrow({
          where: { id_pedido: pedido.id_pedido },
        })
      ).ganho_consolidado_centavos,
    ).toBe(1430);
  });

  it('mesmo entregador em duas empresas usa apenas os parametros de cada pedido', async () => {
    const pedidoEmpresaA = await criarPedidoAtribuido();
    expect(
      (await finalizarPedido(pedidoEmpresaA.id_pedido))
        .ganho_consolidado_centavos,
    ).toBe(1430);
    const pedidoEmpresaB = await repositorioPedidos.criar(
      criarDadosPedido(cpfEntregadorA),
      idEmpresaB,
    );
    expect(pedidoEmpresaB).toMatchObject({
      taxa_fixa_atribuicao_centavos: 200,
      coeficiente_atribuicao_centavos_km: 100,
    });
    expect(
      (await finalizarPedido(pedidoEmpresaB.id_pedido))
        .ganho_consolidado_centavos,
    ).toBe(620);
  });

  it('outro entregador nao consegue concluir', async () => {
    const pedido = await criarPedidoAtribuido();
    await expect(
      finalizarPedido(pedido.id_pedido, cpfEntregadorB),
    ).rejects.toBeInstanceOf(PedidoAlteradoError);
    expect(
      (
        await clientePrisma.pedido.findUniqueOrThrow({
          where: { id_pedido: pedido.id_pedido },
        })
      ).ganho_consolidado_centavos,
    ).toBeNull();
  });

  it('snapshot persiste e reatribuicao substitui os parametros anteriores', async () => {
    const pedido = await criarPedidoAtribuido();
    await repositorioRemuneracao.registrar(
      idEmpresaA,
      { taxaFixa: 950, coeficienteKm: 200 },
      new Date(),
    );
    await repositorioPedidos.reatribuir({
      idPedido: pedido.id_pedido,
      cpfAnterior: cpfEntregadorA,
      cpfNovo: cpfEntregadorB,
      statusAtual: StatusPedido.EM_ANDAMENTO,
    });
    const pedidoPersistido = await clientePrisma.pedido.findUniqueOrThrow({
      where: { id_pedido: pedido.id_pedido },
    });
    expect(pedidoPersistido).toMatchObject({
      taxa_fixa_atribuicao_centavos: 950,
      coeficiente_atribuicao_centavos_km: 200,
    });
    expect(
      pedidoPersistido.remuneracao_atribuida_em!.getTime(),
    ).toBeGreaterThanOrEqual(pedido.remuneracao_atribuida_em!.getTime());
    expect(
      (await finalizarPedido(pedido.id_pedido, cpfEntregadorB))
        .ganho_consolidado_centavos,
    ).toBe(1790);
  });

  it('consulta de vigencia inclui data exata e ignora parametros futuros', async () => {
    const instante = new Date('2026-10-01T12:00:00Z');
    await repositorioRemuneracao.registrar(
      idEmpresaA,
      { taxaFixa: 900, coeficienteKm: 180 },
      instante,
    );
    await repositorioRemuneracao.registrar(
      idEmpresaA,
      { taxaFixa: 1, coeficienteKm: 0 },
      new Date('2099-01-01T00:00:00Z'),
    );
    expect(
      await repositorioRemuneracao.procurarVigentes(idEmpresaA, instante),
    ).toMatchObject({
      taxa_fixa: 900,
      coeficiente: 180,
      data: instante,
    });
  });

  it('atribuicao sem parametros faz rollback e nao aproveita os de outra empresa', async () => {
    await clientePrisma.metricasPagamento.deleteMany({
      where: { idEmpresa: idEmpresaB },
    });
    try {
      await expect(
        repositorioPedidos.criar(criarDadosPedido(cpfEntregadorA), idEmpresaB),
      ).rejects.toThrow('Configure os parâmetros');
      expect(
        await clientePrisma.pedido.count({
          where: { idEmpresa: idEmpresaB },
        }),
      ).toBe(0);
      expect(
        (
          await clientePrisma.entregador.findUniqueOrThrow({
            where: { cpf: cpfEntregadorA },
          })
        ).disponivel,
      ).toBe(true);
    } finally {
      await repositorioRemuneracao.registrar(
        idEmpresaB,
        { taxaFixa: 200, coeficienteKm: 100 },
        inicioVigenciaOriginal,
      );
    }
  });

  it('distancia desconhecida bloqueia conclusao sem atualizacao parcial', async () => {
    const pedido = await criarPedidoAtribuido();
    await clientePrisma.pedido.update({
      where: { id_pedido: pedido.id_pedido },
      data: { distancia: 0, distancia_conhecida: false },
    });
    await expect(finalizarPedido(pedido.id_pedido)).rejects.toThrow(
      'Distância',
    );
    expect(
      await clientePrisma.pedido.findUniqueOrThrow({
        where: { id_pedido: pedido.id_pedido },
      }),
    ).toMatchObject({
      status: 'EM_ANDAMENTO',
      data_finalizacao: null,
      ganho_consolidado_centavos: null,
    });
    await repositorioPedidos.corrigirDistancia(pedido.id_pedido, idEmpresaA, 0);
    expect(
      (await finalizarPedido(pedido.id_pedido)).ganho_consolidado_centavos,
    ).toBe(800);
    await expect(
      repositorioPedidos.corrigirDistancia(pedido.id_pedido, idEmpresaA, 4200),
    ).rejects.toBeInstanceOf(PedidoAlteradoError);
  });

  it('correcao de distancia respeita isolamento entre empresas', async () => {
    const pedido = await criarPedidoAtribuido();
    await expect(
      repositorioPedidos.corrigirDistancia(pedido.id_pedido, idEmpresaB, 0),
    ).rejects.toBeInstanceOf(PedidoAlteradoError);
    expect(
      (
        await clientePrisma.pedido.findUniqueOrThrow({
          where: { id_pedido: pedido.id_pedido },
        })
      ).distancia,
    ).toBe(4200);
  });
});
