import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import {
  CANTINA,
  CARLA,
  PADARIA,
  Sessao,
  entrarComoEmpresa,
  entrarComoEntregador,
  gerarCpfValido,
  semLogin,
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
  let padaria: Sessao;
  let novoEntregador: Sessao;
  let cadastrado: EntregadorCadastrado;
  const cpfNovo = gerarCpfValido();

  function cadastrar(cpf: string, placa = 'ABC1D23') {
    return cantina.post('/entregadores').send({
      nome: 'Entregador do Teste',
      cpf,
      telefone: '61988887777',
      tipoVeiculo: 'MOTO',
      placa,
    });
  }

  async function vinculosDoNovoEntregador(): Promise<Vinculo[]> {
    return (await novoEntregador.get('/entregador/vinculos').expect(200))
      .body as Vinculo[];
  }

  async function cpfsDaFrota(): Promise<string[]> {
    const frota = (await cantina.get('/entregadores').expect(200))
      .body as EntregadorDaFrota[];
    return frota.map((entregador) => entregador.cpf);
  }

  beforeAll(async () => {
    aplicacao = await subirAplicacao();
    cantina = await entrarComoEmpresa(aplicacao, CANTINA.email);
    padaria = await entrarComoEmpresa(aplicacao, PADARIA.email);
  });

  it('recusa placa fora do padrao', async () => {
    await cadastrar(gerarCpfValido(), 'AB12').expect(400);
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

  it('com a senha temporaria, o entregador ainda nao ve nem edita o cadastro', async () => {
    await novoEntregador.get('/entregador/perfil').expect(403);
    await novoEntregador
      .patch('/entregador/perfil')
      .send({ telefone: '61977776666' })
      .expect(403);
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

  it('EN-US08: o entregador edita o proprio cadastro e a empresa ve a mudanca', async () => {
    const perfil = await novoEntregador
      .patch('/entregador/perfil')
      .send({ telefone: '61977776666' })
      .expect(200);

    expect(perfil.body).toEqual({
      nome: 'Entregador do Teste',
      cpf: cpfNovo,
      telefone: '61977776666',
      tipoVeiculo: 'MOTO',
      placa: 'ABC1D23',
    });
    await novoEntregador
      .get('/entregador/perfil')
      .expect(200)
      .expect(perfil.body);
    const frota = (await cantina.get('/entregadores').expect(200))
      .body as EntregadorDaFrota[];
    expect(frota.find((entregador) => entregador.cpf === cpfNovo)).toEqual(
      expect.objectContaining({ telefone: '61977776666' }),
    );
  });

  it('EN-US08: o CPF nao muda e a placa segue a regra do veiculo', async () => {
    await novoEntregador
      .patch('/entregador/perfil')
      .send({ cpf: gerarCpfValido() })
      .expect(400);

    const bicicleta = await novoEntregador
      .patch('/entregador/perfil')
      .send({ tipoVeiculo: 'BICICLETA' })
      .expect(200);
    expect(bicicleta.body).toEqual(
      expect.objectContaining({ tipoVeiculo: 'BICICLETA', placa: null }),
    );

    await novoEntregador
      .patch('/entregador/perfil')
      .send({ tipoVeiculo: 'MOTO' })
      .expect(400);
    await novoEntregador
      .patch('/entregador/perfil')
      .send({ tipoVeiculo: 'MOTO', placa: 'abc-1d23' })
      .expect(200);
  });

  it('EN-US08: nenhuma empresa edita o cadastro do entregador', async () => {
    await cantina
      .patch('/entregadores')
      .send({ cpf: cpfNovo, telefone: '61900000000' })
      .expect(404);
    await cantina.get('/entregador/perfil').expect(403);
  });

  it('o entregador pode recusar o convite de outra empresa', async () => {
    await padaria
      .post('/entregadores/vinculo')
      .send({ cpf: cpfNovo })
      .expect(202);
    const conviteDaPadaria = (await vinculosDoNovoEntregador()).find(
      (vinculo) => vinculo.empresa === PADARIA.nome,
    );

    await novoEntregador
      .post(`/entregador/vinculos/${conviteDaPadaria?.id}/recusar`)
      .expect((resposta) => {
        expect(resposta.status).toBeLessThan(300);
      });
    expect(
      (await vinculosDoNovoEntregador()).map((vinculo) => vinculo.empresa),
    ).not.toContain(PADARIA.nome);
  });

  it('a empresa encerra o vinculo e perde o entregador da frota', async () => {
    const remocao = await cantina
      .delete(`/entregadores/${cpfNovo}/vinculo`)
      .expect(200);

    expect(remocao.body).toEqual({ reatribuidos: [], pendentes: [] });

    expect(await cpfsDaFrota()).not.toContain(cpfNovo);
    await cantina.delete(`/entregadores/${cpfNovo}/vinculo`).expect(404);
  });

  it('antes do primeiro acesso, a empresa gera outra senha e a anterior deixa de valer', async () => {
    const cpf = gerarCpfValido();
    const primeira = (await cadastrar(cpf).expect(201))
      .body as EntregadorCadastrado;

    const segunda = (
      await cantina.post(`/entregadores/${cpf}/senha-temporaria`).expect(200)
    ).body as { senhaTemporaria: string };

    expect(segunda.senhaTemporaria).not.toBe(primeira.senhaTemporaria);
    await semLogin(aplicacao)
      .post('/auth/login/entregador')
      .send({ cpf, senha: primeira.senhaTemporaria })
      .expect(401);
    await entrarComoEntregador(aplicacao, cpf, segunda.senhaTemporaria);
  });
});
