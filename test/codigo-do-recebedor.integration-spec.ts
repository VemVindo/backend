import {
  BLOQUEIO_CODIGO_MS,
  CodigoDoRecebedorService,
  LIMITE_TENTATIVAS_CODIGO,
} from '../src/rastreio/codigo-do-recebedor.service';
import { RastreioRepository } from '../src/rastreio/rastreio.repository';
import {
  BancoIsolado,
  TEMPO_LIMITE_PREPARACAO_MS,
  cadastrarEmpresa,
  cadastrarPedido,
  criarBancoIsolado,
  descreverComBanco,
} from './apoio/banco-isolado';

const CODIGO = '482913';
const CODIGO_ERRADO = '000000';
const AGORA = new Date('2026-10-25T15:00:00Z');

function minutosDepois(minutos: number): Date {
  return new Date(AGORA.getTime() + minutos * 60_000);
}

descreverComBanco('EN-US06 codigo do recebedor no PostgreSQL', () => {
  let banco: BancoIsolado;
  let rastreio: RastreioRepository;
  let codigos: CodigoDoRecebedorService;
  let idEmpresa: number;
  let idPedido: number;

  async function tentativasGravadas() {
    const acesso = await banco.prisma.acessoRecebedor.findUniqueOrThrow({
      where: { idPedido },
    });
    return {
      tentativas: acesso.tentativas_codigo,
      ultima: acesso.ultima_tentativa_codigo,
    };
  }

  async function errar(vezes: number) {
    for (let tentativa = 0; tentativa < vezes; tentativa++) {
      await codigos.conferir(idPedido, CODIGO_ERRADO, AGORA);
    }
  }

  beforeAll(async () => {
    banco = await criarBancoIsolado('codigo');
    rastreio = new RastreioRepository(banco.prisma);
    codigos = new CodigoDoRecebedorService(rastreio);
    idEmpresa = await cadastrarEmpresa(banco.prisma, 'codigo');
  }, TEMPO_LIMITE_PREPARACAO_MS);

  beforeEach(async () => {
    idPedido = await cadastrarPedido(banco.prisma, idEmpresa);
    await rastreio.salvarAcesso(idPedido, `hash-${idPedido}`, CODIGO);
  });

  afterAll(async () => {
    await banco?.encerrar();
  });

  it('pedido sem link ainda nao tem codigo', async () => {
    const semLink = await cadastrarPedido(banco.prisma, idEmpresa);

    await expect(codigos.conferir(semLink, CODIGO, AGORA)).resolves.toEqual({
      situacao: 'sem_codigo',
    });
  });

  it('o codigo certo nao grava tentativa', async () => {
    await expect(codigos.conferir(idPedido, CODIGO, AGORA)).resolves.toEqual({
      situacao: 'correto',
    });
    expect(await tentativasGravadas()).toEqual({ tentativas: 0, ultima: null });
  });

  it('cada erro fica gravado com o horario da tentativa', async () => {
    await errar(2);

    expect(await tentativasGravadas()).toEqual({
      tentativas: 2,
      ultima: AGORA,
    });
  });

  it('depois do limite bloqueia ate o codigo certo pelo tempo do bloqueio', async () => {
    await errar(LIMITE_TENTATIVAS_CODIGO);

    await expect(codigos.conferir(idPedido, CODIGO, AGORA)).resolves.toEqual({
      situacao: 'bloqueado',
      liberaEm: new Date(AGORA.getTime() + BLOQUEIO_CODIGO_MS),
    });
    expect((await tentativasGravadas()).tentativas).toBe(
      LIMITE_TENTATIVAS_CODIGO,
    );
  });

  it('passado o bloqueio, a contagem recomeca do zero', async () => {
    await errar(LIMITE_TENTATIVAS_CODIGO);

    await expect(
      codigos.conferir(idPedido, CODIGO_ERRADO, minutosDepois(15)),
    ).resolves.toEqual({
      situacao: 'incorreto',
      tentativasRestantes: LIMITE_TENTATIVAS_CODIGO - 1,
    });
    expect(await tentativasGravadas()).toEqual({
      tentativas: 1,
      ultima: minutosDepois(15),
    });
  });

  it('gerar outro link troca o token mas nao zera o codigo nem as tentativas', async () => {
    await errar(3);

    const acesso = await rastreio.salvarAcesso(
      idPedido,
      `hash-novo-${idPedido}`,
      '999999',
    );

    expect(acesso.codigo_recebedor).toBe(CODIGO);
    expect(acesso.token_hash).toBe(`hash-novo-${idPedido}`);
    expect((await tentativasGravadas()).tentativas).toBe(3);
  });
});
