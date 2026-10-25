import { ConflictException } from '@nestjs/common';
import { CredencialRepository } from '../src/integracao/credencial.repository';
import { CredencialService } from '../src/integracao/credencial.service';
import {
  BancoIsolado,
  TEMPO_LIMITE_PREPARACAO_MS,
  cadastrarEmpresa,
  criarBancoIsolado,
  descreverComBanco,
} from './apoio/banco-isolado';

function segredoDa(chave: string, prefixo: string): string {
  return chave.slice(`vv_${prefixo}_`.length);
}

descreverComBanco('E-US12 credencial de integracao no PostgreSQL', () => {
  let banco: BancoIsolado;
  let credenciais: CredencialService;
  let cantina: number;
  let padaria: number;

  function gravadasDa(idEmpresa: number) {
    return banco.prisma.credencialIntegracao.findMany({
      where: { idEmpresa },
      orderBy: { id_credencial: 'asc' },
    });
  }

  beforeAll(async () => {
    banco = await criarBancoIsolado('credencial');
    credenciais = new CredencialService(new CredencialRepository(banco.prisma));
    cantina = await cadastrarEmpresa(banco.prisma, 'cantina');
    padaria = await cadastrarEmpresa(banco.prisma, 'padaria');
  }, TEMPO_LIMITE_PREPARACAO_MS);

  beforeEach(async () => {
    await banco.prisma.credencialIntegracao.deleteMany();
  });

  afterAll(async () => {
    await banco?.encerrar();
  });

  it('o banco guarda so o prefixo e o hash, nunca o segredo', async () => {
    const { chave } = await credenciais.gerar(cantina);

    const [gravada] = await gravadasDa(cantina);
    expect(chave).toContain(gravada.prefixo);
    expect(gravada.hash).not.toContain(segredoDa(chave, gravada.prefixo));
    expect(JSON.stringify(gravada)).not.toContain(chave);
  });

  it('a chave autentica como a propria empresa e registra o uso', async () => {
    const { chave } = await credenciais.gerar(cantina);

    await expect(credenciais.autenticar(chave)).resolves.toMatchObject({
      empresaId: cantina,
    });
    const [gravada] = await gravadasDa(cantina);
    expect(gravada.ultimo_uso).toBeInstanceOf(Date);
  });

  it('chave com o prefixo certo e o segredo adulterado nao autentica', async () => {
    const { chave } = await credenciais.gerar(cantina);
    const adulterada = `${chave.slice(0, -1)}${chave.endsWith('A') ? 'B' : 'A'}`;

    await expect(credenciais.autenticar(adulterada)).resolves.toBeNull();
  });

  it('duas geracoes ao mesmo tempo deixam so uma credencial ativa', async () => {
    const resultados = await Promise.allSettled([
      credenciais.gerar(padaria),
      credenciais.gerar(padaria),
    ]);

    const recusadas = resultados.filter(
      (resultado) => resultado.status === 'rejected',
    );
    expect(recusadas).toHaveLength(1);
    expect(recusadas[0].reason).toBeInstanceOf(ConflictException);
    expect(await gravadasDa(padaria)).toHaveLength(1);
  });

  it('rotacionar revoga a anterior na mesma operacao', async () => {
    const antiga = await credenciais.gerar(cantina);

    const nova = await credenciais.rotacionar(cantina);

    await expect(credenciais.autenticar(antiga.chave)).resolves.toBeNull();
    await expect(credenciais.autenticar(nova.chave)).resolves.toMatchObject({
      empresaId: cantina,
    });
    const gravadas = await gravadasDa(cantina);
    expect(gravadas.map((gravada) => gravada.data_revogacao !== null)).toEqual([
      true,
      false,
    ]);
  });

  it('revogar desliga a integracao da empresa', async () => {
    const { chave } = await credenciais.gerar(cantina);

    await credenciais.revogar(cantina);

    await expect(credenciais.autenticar(chave)).resolves.toBeNull();
    await expect(credenciais.consultar(cantina)).resolves.toEqual({
      credencial: null,
    });
  });

  it('a credencial de uma empresa nunca autentica como outra', async () => {
    const daCantina = await credenciais.gerar(cantina);
    const daPadaria = await credenciais.gerar(padaria);

    await expect(
      credenciais.autenticar(daCantina.chave),
    ).resolves.toMatchObject({ empresaId: cantina });
    await expect(
      credenciais.autenticar(daPadaria.chave),
    ).resolves.toMatchObject({ empresaId: padaria });
  });
});
