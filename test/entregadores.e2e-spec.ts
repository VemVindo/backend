import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import {
  CANTINA,
  CARLA,
  Sessao,
  entrarComoEmpresa,
  entrarComoEntregador,
  gerarCpfValido,
  subirAplicacao,
} from './apoio/aplicacao';

interface EntregadorCadastrado {
  status: string;
  senhaTemporaria: string;
  senhaTemporariaExpiraEm: string;
}

interface Vinculo {
  id: number;
  empresa: string;
  status: string;
}

interface EntregadorDaFrota {
  cpf: string;
  telefone: string;
}

const NOVA_SENHA = 'MinhaSenha@2026';

describe('E-US04 cadastro e convite de entregador (e2e)', () => {
  let aplicacao: INestApplication<App>;
  let cantina: Sessao;
  let novoEntregador: Sessao;
  let cadastrado: EntregadorCadastrado;
  const cpfNovo = gerarCpfValido();

  function cadastrar(cpf: string) {
    return cantina.post('/entregadores').send({
      nome: 'Entregador do Teste',
      cpf,
      telefone: '61988887777',
      tipoVeiculo: 'MOTO',
      placa: 'ABC1D23',
    });
  }

  async function cpfsDaFrota(): Promise<string[]> {
    const frota = (await cantina.get('/entregadores').expect(200))
      .body as EntregadorDaFrota[];
    return frota.map((entregador) => entregador.cpf);
  }

  beforeAll(async () => {
    aplicacao = await subirAplicacao();
    cantina = await entrarComoEmpresa(aplicacao, CANTINA.email);
  });

  afterAll(async () => {
    await aplicacao.close();
  });

  it('cadastra o entregador novo com senha temporaria e convite pendente', async () => {
    cadastrado = (await cadastrar(cpfNovo).expect(201))
      .body as EntregadorCadastrado;

    expect(cadastrado.status).toBe('PENDENTE');
    expect(cadastrado.senhaTemporaria.length).toBeGreaterThanOrEqual(8);
    expect(
      new Date(cadastrado.senhaTemporariaExpiraEm).getTime(),
    ).toBeGreaterThan(Date.now());
  });

  it.each([
    ['o CPF que acabou de ser cadastrado', () => cpfNovo],
    ['o CPF de quem ja usa a plataforma', () => CARLA],
  ])(
    'recusa cadastrar de novo %s e orienta a usar o convite',
    async (_caso, cpf) => {
      const body: unknown = (await cadastrar(cpf()).expect(409)).body;

      expect(JSON.stringify(body)).toContain('convite');
    },
  );

  it('responde o convite igual para CPF cadastrado e para CPF que nao existe', async () => {
    const conviteParaCarla = await cantina
      .post('/entregadores/vinculo')
      .send({ cpf: CARLA })
      .expect(202);
    const conviteParaNinguem = await cantina
      .post('/entregadores/vinculo')
      .send({ cpf: gerarCpfValido() })
      .expect(202);

    expect(conviteParaNinguem.body).toEqual(conviteParaCarla.body);
  });

  it('antes do aceite, a empresa nao ve o entregador na frota', async () => {
    expect(await cpfsDaFrota()).not.toContain(cpfNovo);
  });

  it('no primeiro acesso, o entregador so troca a senha e ve o convite', async () => {
    novoEntregador = await entrarComoEntregador(
      aplicacao,
      cpfNovo,
      cadastrado.senhaTemporaria,
    );

    await novoEntregador.get('/pedidos/minhas-entregas').expect(403);
    const vinculos = (
      await novoEntregador.get('/entregador/vinculos').expect(200)
    ).body as Vinculo[];
    expect(vinculos).toEqual([
      expect.objectContaining({ empresa: CANTINA.nome, status: 'PENDENTE' }),
    ]);
  });

  it('a troca de senha do primeiro acesso exige a ciencia dos dados compartilhados', async () => {
    await novoEntregador
      .post('/auth/entregador/trocar-senha')
      .send({ senhaAtual: cadastrado.senhaTemporaria, novaSenha: NOVA_SENHA })
      .expect(400);

    await novoEntregador
      .post('/auth/entregador/trocar-senha')
      .send({
        senhaAtual: cadastrado.senhaTemporaria,
        novaSenha: NOVA_SENHA,
        cienteDadosCompartilhados: true,
      })
      .expect(200);
    await novoEntregador.get('/pedidos/minhas-entregas').expect(200);
  });

  it('depois do primeiro acesso, a empresa nao gera outra senha para ele', async () => {
    await cantina.post(`/entregadores/${cpfNovo}/senha-temporaria`).expect(404);
  });

  it('ao aceitar o convite, ele entra na frota da empresa', async () => {
    const [convite] = (
      await novoEntregador.get('/entregador/vinculos').expect(200)
    ).body as Vinculo[];

    await novoEntregador
      .post(`/entregador/vinculos/${convite.id}/aceitar`)
      .expect((resposta) => {
        expect(resposta.status).toBeLessThan(300);
      });
    expect(await cpfsDaFrota()).toContain(cpfNovo);
  });
});
