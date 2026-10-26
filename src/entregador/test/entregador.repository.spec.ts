import { PrismaService } from '../../prisma/prisma.service';
import { StatusContrato } from '../../generated/prisma/enums';
import { EntregadorRepository } from '../entregador.repository';

describe('EntregadorRepository consultas e senha', () => {
  const CPF_ENTREGADOR = '52998224725';
  const ID_EMPRESA = 7;
  const EXPIRA_EM = new Date('2026-10-26T12:00:00Z');
  const CONTRATO_ATIVO = {
    some: { idEmpresa: ID_EMPRESA, status: StatusContrato.ATIVO },
  };

  function montar() {
    const entregador = {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    };
    const repositorio = new EntregadorRepository({
      entregador,
    } as unknown as PrismaService);
    return { repositorio, entregador };
  }

  function dadosGravados(update: jest.Mock) {
    const [[{ data }]] = update.mock.calls as [[{ data: object }]];
    return data;
  }

  it('procura pelo CPF', async () => {
    const { repositorio, entregador } = montar();

    await repositorio.procurarPorCpf(CPF_ENTREGADOR);

    expect(entregador.findUnique).toHaveBeenCalledWith({
      where: { cpf: CPF_ENTREGADOR },
    });
  });

  it('so traz entregadores com contrato ativo na empresa', async () => {
    const { repositorio, entregador } = montar();

    await repositorio.procurarAtivosPorEmpresa(ID_EMPRESA);
    await repositorio.procurarAtivoPorEmpresa(ID_EMPRESA, CPF_ENTREGADOR);

    expect(entregador.findMany).toHaveBeenCalledWith({
      where: { contratos: CONTRATO_ATIVO },
    });
    expect(entregador.findFirst).toHaveBeenCalledWith({
      where: { cpf: CPF_ENTREGADOR, contratos: CONTRATO_ATIVO },
    });
  });

  it('cria o entregador com contrato pendente na empresa', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-25T12:00:00Z') });
    const { repositorio, entregador } = montar();

    await repositorio.criarComConvite(
      {
        nome: 'Ana Souza',
        cpf: CPF_ENTREGADOR,
        telefone: '61990000000',
        tipoVeiculo: 'MOTO',
        placa: null,
        senhaHash: 'hash',
        senhaTemporariaExpiraEm: EXPIRA_EM,
      },
      ID_EMPRESA,
    );

    expect(dadosGravados(entregador.create)).toEqual({
      nome: 'Ana Souza',
      cpf: CPF_ENTREGADOR,
      telefone: '61990000000',
      tipo_veiculo: 'MOTO',
      placa: null,
      senha: 'hash',
      senha_temporaria_expira_em: EXPIRA_EM,
      contratos: {
        create: {
          idEmpresa: ID_EMPRESA,
          status: StatusContrato.PENDENTE,
          data_inicio: new Date('2026-10-25T12:00:00Z'),
        },
      },
    });
    jest.useRealTimers();
  });

  it('troca a senha, encerra as sessoes e registra a ciencia quando vier', async () => {
    const { repositorio, entregador } = montar();

    await repositorio.atualizarSenha(CPF_ENTREGADOR, 'hash', EXPIRA_EM);

    expect(entregador.update).toHaveBeenCalledWith({
      where: { cpf: CPF_ENTREGADOR },
      data: {
        senha: 'hash',
        senha_temporaria: false,
        senha_temporaria_expira_em: null,
        sessao_versao: { increment: 1 },
        ciencia_dados_em: EXPIRA_EM,
      },
    });
  });

  it('troca a senha sem mexer na ciencia quando ela nao vem', async () => {
    const { repositorio, entregador } = montar();

    await repositorio.atualizarSenha(CPF_ENTREGADOR, 'hash');

    expect(dadosGravados(entregador.update)).not.toHaveProperty(
      'ciencia_dados_em',
    );
  });

  it('so redefine a senha de quem ainda esta com a temporaria', async () => {
    const { repositorio, entregador } = montar();

    await expect(
      repositorio.redefinirSenhaTemporaria(CPF_ENTREGADOR, 'hash', EXPIRA_EM),
    ).resolves.toBe(true);
    expect(entregador.updateMany).toHaveBeenCalledWith({
      where: { cpf: CPF_ENTREGADOR, senha_temporaria: true },
      data: {
        senha: 'hash',
        senha_temporaria_expira_em: EXPIRA_EM,
        sessao_versao: { increment: 1 },
      },
    });

    entregador.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      repositorio.redefinirSenhaTemporaria(CPF_ENTREGADOR, 'hash', EXPIRA_EM),
    ).resolves.toBe(false);
  });

  it('devolve a versao da sessao ou null para CPF desconhecido', async () => {
    const { repositorio, entregador } = montar();
    entregador.findUnique.mockResolvedValueOnce({ sessao_versao: 3 });

    await expect(repositorio.versaoSessao(CPF_ENTREGADOR)).resolves.toBe(3);
    await expect(repositorio.versaoSessao(CPF_ENTREGADOR)).resolves.toBeNull();
    expect(entregador.findUnique).toHaveBeenCalledWith({
      where: { cpf: CPF_ENTREGADOR },
      select: { sessao_versao: true },
    });
  });

  it('encerra as sessoes subindo a versao', async () => {
    const { repositorio, entregador } = montar();

    await repositorio.encerrarSessoes(CPF_ENTREGADOR);

    expect(entregador.update).toHaveBeenCalledWith({
      where: { cpf: CPF_ENTREGADOR },
      data: { sessao_versao: { increment: 1 } },
    });
  });

  it('na edicao ignora os campos nulos ou ausentes', async () => {
    const { repositorio, entregador } = montar();

    await repositorio.atualizar(CPF_ENTREGADOR, {
      nome: null,
      telefone: undefined,
      veiculo: null,
      placa: 'ABC1D23',
    });

    expect(dadosGravados(entregador.update)).toEqual({ placa: 'ABC1D23' });
  });

  it('na edicao grava o veiculo como tipo_veiculo', async () => {
    const { repositorio, entregador } = montar();

    await repositorio.atualizar(CPF_ENTREGADOR, {
      nome: 'Ana',
      telefone: '61990000000',
      veiculo: 'CARRO',
    });

    expect(dadosGravados(entregador.update)).toEqual({
      nome: 'Ana',
      telefone: '61990000000',
      tipo_veiculo: 'CARRO',
    });
  });

  it('na edicao devolve o entregador gravado', async () => {
    const { repositorio, entregador } = montar();
    const gravado = { cpf: CPF_ENTREGADOR, nome: 'Ana' };
    entregador.update.mockResolvedValue(gravado);

    await expect(
      repositorio.atualizar(CPF_ENTREGADOR, { nome: 'Ana' }),
    ).resolves.toBe(gravado);
  });
});
