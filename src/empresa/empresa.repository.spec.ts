import { PrismaService } from '../prisma/prisma.service';
import {
  DadosCadastrais,
  DadosNovaEmpresa,
  EmpresaRepository,
} from './empresa.repository';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

function montar(encontrada: object | null) {
  const prisma = {
    empresa: {
      findUnique: jest.fn().mockResolvedValue(encontrada),
      create: jest.fn().mockResolvedValue({ id_empresa: 3 }),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  return {
    repositorio: new EmpresaRepository(prisma as unknown as PrismaService),
    prisma,
  };
}

describe('EmpresaRepository configuracao do mapa', () => {
  it('le so o campo exibir_mapa', async () => {
    const { repositorio, prisma } = montar({ exibir_mapa: false });

    await expect(repositorio.exibeMapa(3)).resolves.toBe(false);
    expect(prisma.empresa.findUnique).toHaveBeenCalledWith({
      where: { id_empresa: 3 },
      select: { exibir_mapa: true },
    });
  });

  it('devolve null para empresa inexistente', async () => {
    const { repositorio } = montar(null);
    await expect(repositorio.exibeMapa(3)).resolves.toBeNull();
  });

  it('grava a escolha da empresa', async () => {
    const { repositorio, prisma } = montar({ exibir_mapa: true });

    await repositorio.definirExibirMapa(3, false);

    expect(prisma.empresa.update).toHaveBeenCalledWith({
      where: { id_empresa: 3 },
      data: { exibir_mapa: false },
    });
  });
});

const DADOS_CADASTRAIS: DadosCadastrais = {
  nomeFantasia: 'Padaria Central',
  email: 'contato@padaria.exemplo',
  telefone: '61900000000',
  cep: '70000000',
  logradouro: 'Rua A',
  numero: 10,
  complemento: null,
  bairro: 'Centro',
  cidade: 'Brasilia',
  uf: 'DF',
};

const NOVA_EMPRESA: DadosNovaEmpresa = {
  ...DADOS_CADASTRAIS,
  cnpj: '11222333000181',
  cpf: null,
  razaoSocial: 'Padaria Central LTDA',
  senhaHash: 'hash-da-senha',
};

const CAMPOS_CADASTRAIS = {
  nome_fantasia: 'Padaria Central',
  email: 'contato@padaria.exemplo',
  telefone: '61900000000',
  cep: '70000000',
  logradouro: 'Rua A',
  numero: 10,
  complemento: null,
  bairro: 'Centro',
  cidade: 'Brasilia',
  UF: 'DF',
};

describe('EmpresaRepository cadastro', () => {
  it('procura por e-mail e por id', async () => {
    const { repositorio, prisma } = montar(null);

    await repositorio.procurarPorEmail('contato@padaria.exemplo');
    await repositorio.procurarPorId(3);

    expect(prisma.empresa.findUnique).toHaveBeenNthCalledWith(1, {
      where: { email: 'contato@padaria.exemplo' },
    });
    expect(prisma.empresa.findUnique).toHaveBeenNthCalledWith(2, {
      where: { id_empresa: 3 },
    });
  });

  it('encontra a empresa pelo CNPJ sem consultar o CPF', async () => {
    const { repositorio, prisma } = montar({ id_empresa: 3 });

    await expect(
      repositorio.procurarPorDocumento('11222333000181', '52998224725'),
    ).resolves.toEqual({ id_empresa: 3 });
    expect(prisma.empresa.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.empresa.findUnique).toHaveBeenCalledWith({
      where: { CNPJ: '11222333000181' },
    });
  });

  it('tenta o CPF quando o CNPJ nao esta cadastrado', async () => {
    const { repositorio, prisma } = montar(null);
    prisma.empresa.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id_empresa: 4 });

    await expect(
      repositorio.procurarPorDocumento('11222333000181', '52998224725'),
    ).resolves.toEqual({ id_empresa: 4 });
    expect(prisma.empresa.findUnique).toHaveBeenLastCalledWith({
      where: { cpf: '52998224725' },
    });
  });

  it('devolve null quando nenhum documento esta cadastrado', async () => {
    const { repositorio, prisma } = montar(null);

    await expect(
      repositorio.procurarPorDocumento(null, '52998224725'),
    ).resolves.toBeNull();
    await expect(
      repositorio.procurarPorDocumento('11222333000181', null),
    ).resolves.toBeNull();
    await expect(
      repositorio.procurarPorDocumento(null, null),
    ).resolves.toBeNull();
    expect(prisma.empresa.findUnique).toHaveBeenCalledTimes(2);
  });

  it('cria a empresa com os nomes de coluna do banco', async () => {
    const { repositorio, prisma } = montar(null);

    await expect(repositorio.criar(NOVA_EMPRESA)).resolves.toEqual({
      id_empresa: 3,
    });
    expect(prisma.empresa.create).toHaveBeenCalledWith({
      data: {
        ...CAMPOS_CADASTRAIS,
        CNPJ: '11222333000181',
        cpf: null,
        razao_social: 'Padaria Central LTDA',
        senha: 'hash-da-senha',
      },
    });
  });

  it('atualiza o cadastro mantendo a origem quando o endereco nao mudou', async () => {
    const { repositorio, prisma } = montar(null);
    const agora = new Date('2026-10-25T12:00:00Z');

    await repositorio.atualizarCadastro(3, DADOS_CADASTRAIS, false, agora);

    expect(prisma.empresa.update).toHaveBeenCalledWith({
      where: { id_empresa: 3 },
      data: { ...CAMPOS_CADASTRAIS, cadastro_atualizado_em: agora },
    });
  });

  it('apaga a origem geocodificada quando o endereco mudou', async () => {
    const { repositorio, prisma } = montar(null);
    const agora = new Date('2026-10-25T12:00:00Z');

    await repositorio.atualizarCadastro(3, DADOS_CADASTRAIS, true, agora);

    expect(prisma.empresa.update).toHaveBeenCalledWith({
      where: { id_empresa: 3 },
      data: {
        ...CAMPOS_CADASTRAIS,
        cadastro_atualizado_em: agora,
        origem_lat: null,
        origem_lng: null,
      },
    });
  });
});

describe('EmpresaRepository sessoes', () => {
  it('le a versao da sessao', async () => {
    const { repositorio, prisma } = montar({ sessao_versao: 2 });

    await expect(repositorio.versaoSessao(3)).resolves.toBe(2);
    expect(prisma.empresa.findUnique).toHaveBeenCalledWith({
      where: { id_empresa: 3 },
      select: { sessao_versao: true },
    });
  });

  it('devolve null para empresa inexistente', async () => {
    const { repositorio } = montar(null);

    await expect(repositorio.versaoSessao(3)).resolves.toBeNull();
  });

  it('encerra as sessoes incrementando a versao', async () => {
    const { repositorio, prisma } = montar(null);

    await repositorio.encerrarSessoes(3);

    expect(prisma.empresa.update).toHaveBeenCalledWith({
      where: { id_empresa: 3 },
      data: { sessao_versao: { increment: 1 } },
    });
  });
});
