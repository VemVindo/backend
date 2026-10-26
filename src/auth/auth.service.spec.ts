import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Cargo } from '../common/enums/cargo.enum';
import { EmpresaRepository } from '../empresa/empresa.repository';
import { EntregadorRepository } from '../entregador/entregador.repository';
import { AuthService } from './auth.service';
import { CadastrarEmpresaDto } from './dto/cadastrar-empresa.dto';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

const CPF_FICTICIO = '52998224725';
const DAQUI_A_UM_DIA = new Date(Date.now() + 24 * 60 * 60 * 1000);
const ONTEM = new Date(Date.now() - 24 * 60 * 60 * 1000);

function montar() {
  const empresas = {
    procurarPorEmail: jest.fn().mockResolvedValue(null),
    procurarPorId: jest.fn().mockResolvedValue(null),
    procurarPorDocumento: jest.fn().mockResolvedValue(null),
    criar: jest.fn(),
    encerrarSessoes: jest.fn().mockResolvedValue(undefined),
  };
  const entregadores = {
    procurarPorCpf: jest.fn().mockResolvedValue(null),
    atualizarSenha: jest.fn((cpf: string) =>
      Promise.resolve({
        cpf,
        nome: 'Entregador Teste',
        senha_temporaria: false,
        sessao_versao: 1,
      }),
    ),
    encerrarSessoes: jest.fn().mockResolvedValue(undefined),
  };
  const jwt = {
    sign: jest.fn().mockReturnValue('token'),
    decode: jest.fn().mockReturnValue({ exp: 1_900_000_000 }),
  };
  const senha = {
    hash: jest.fn().mockResolvedValue('hash'),
    comparar: jest.fn().mockResolvedValue(true),
    verificar: jest.fn().mockResolvedValue(false),
  };
  const servico = new AuthService(
    empresas as unknown as EmpresaRepository,
    entregadores as unknown as EntregadorRepository,
    jwt as unknown as JwtService,
    senha,
  );
  return { servico, empresas, entregadores, jwt, senha };
}

const cadastro = {
  nomeFantasia: 'Loja Teste',
  email: 'loja@example.com',
  telefone: '61900000000',
  cnpj: '11222333000181',
  razaoSocial: 'Loja Teste Ltda',
  cep: '70000000',
  logradouro: 'Rua Teste',
  numero: 10,
  bairro: 'Centro',
  cidade: 'Brasilia',
  uf: 'DF',
  senha: 'senha-segura',
} as CadastrarEmpresaDto;

describe('AuthService.cadastrarEmpresa', () => {
  it('exige exatamente um documento', async () => {
    const { servico } = montar();
    await expect(
      servico.cadastrarEmpresa({ ...cadastro, cnpj: undefined }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      servico.cadastrarEmpresa({ ...cadastro, cpf: CPF_FICTICIO }),
    ).rejects.toThrow(BadRequestException);
  });

  it('exige a razao social de quem se cadastra por CNPJ', async () => {
    const { servico, empresas } = montar();

    await expect(
      servico.cadastrarEmpresa({ ...cadastro, razaoSocial: undefined }),
    ).rejects.toThrow('Razao social e obrigatoria para CNPJ');
    expect(empresas.criar).not.toHaveBeenCalled();
  });

  it('recusa e-mail ou documento que ja tem cadastro', async () => {
    const { servico, empresas } = montar();
    empresas.procurarPorEmail.mockResolvedValueOnce({ id_empresa: 1 });
    await expect(servico.cadastrarEmpresa(cadastro)).rejects.toThrow(
      'E-mail ja cadastrado',
    );

    empresas.procurarPorDocumento.mockResolvedValueOnce({ id_empresa: 1 });
    await expect(servico.cadastrarEmpresa(cadastro)).rejects.toThrow(
      'Documento ja cadastrado',
    );
    expect(empresas.criar).not.toHaveBeenCalled();
  });

  it('cadastra por CPF sem CNPJ nem razao social', async () => {
    const { servico, empresas } = montar();
    empresas.criar.mockResolvedValue({ id_empresa: 8, sessao_versao: 0 });

    await servico.cadastrarEmpresa({
      ...cadastro,
      cnpj: undefined,
      razaoSocial: undefined,
      cpf: CPF_FICTICIO,
    });

    expect(empresas.procurarPorDocumento).toHaveBeenCalledWith(
      null,
      CPF_FICTICIO,
    );
    expect(empresas.criar).toHaveBeenCalledWith(
      expect.objectContaining({
        cnpj: null,
        cpf: CPF_FICTICIO,
        razaoSocial: null,
        senhaHash: 'hash',
      }),
    );
  });

  it('converte corrida no unique do banco em 409', async () => {
    const { servico, empresas } = montar();
    empresas.criar.mockRejectedValue({ code: 'P2002' });
    await expect(servico.cadastrarEmpresa(cadastro)).rejects.toThrow(
      ConflictException,
    );
  });

  it('repassa outros erros do banco', async () => {
    const { servico, empresas } = montar();
    const falha = new Error('conexao perdida');
    empresas.criar.mockRejectedValue(falha);

    await expect(servico.cadastrarEmpresa(cadastro)).rejects.toBe(falha);
  });

  it('assina o token com cargo, empresaId e versao da sessao', async () => {
    const { servico, empresas, jwt } = montar();
    empresas.criar.mockResolvedValue({
      id_empresa: 7,
      nome_fantasia: 'Loja Teste',
      email: 'loja@example.com',
      sessao_versao: 0,
    });

    const resposta = await servico.cadastrarEmpresa(cadastro);

    expect(jwt.sign).toHaveBeenCalledWith({
      sub: '7',
      cargo: Cargo.ESTABELECIMENTO,
      empresaId: '7',
      versao: 0,
    });
    expect(resposta.tokenAcesso).toBe('token');
    expect(resposta.expiraEm).toEqual(new Date(1_900_000_000 * 1000));
    expect(resposta.usuario).toEqual({
      id: 7,
      nomeFantasia: 'Loja Teste',
      email: 'loja@example.com',
      cargo: Cargo.ESTABELECIMENTO,
    });
  });
});

describe('AuthService login', () => {
  it('passa pelo bcrypt mesmo quando o e-mail nao existe', async () => {
    const { servico, senha } = montar();
    await expect(
      servico.loginEmpresa({ email: 'nada@example.com', senha: 'x' }),
    ).rejects.toThrow(UnauthorizedException);
    expect(senha.verificar).toHaveBeenCalledWith('x', undefined);
  });

  it('passa pelo bcrypt mesmo quando o CPF nao existe', async () => {
    const { servico, senha } = montar();
    await expect(
      servico.loginEntregador({ cpf: CPF_FICTICIO, senha: 'x' }),
    ).rejects.toThrow(UnauthorizedException);
    expect(senha.verificar).toHaveBeenCalledWith('x', undefined);
  });

  it('autentica entregador com senha temporaria dentro do prazo', async () => {
    const { servico, entregadores, senha, jwt } = montar();
    entregadores.procurarPorCpf.mockResolvedValue({
      cpf: CPF_FICTICIO,
      nome: 'Entregador Teste',
      senha: 'hash',
      senha_temporaria: true,
      senha_temporaria_expira_em: DAQUI_A_UM_DIA,
      sessao_versao: 3,
    });
    senha.verificar.mockResolvedValue(true);

    const resposta = await servico.loginEntregador({
      cpf: CPF_FICTICIO,
      senha: 'x',
    });

    expect(jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({ sub: CPF_FICTICIO, versao: 3 }),
    );
    expect(resposta.usuario).toEqual({
      cpf: CPF_FICTICIO,
      nome: 'Entregador Teste',
      cargo: Cargo.ENTREGADOR,
      senhaTemporaria: true,
    });
  });
});

describe('AuthService login com a senha errada', () => {
  it.each([
    ['empresa', 'loginEmpresa', 'procurarPorEmail'],
    ['entregador', 'loginEntregador', 'procurarPorCpf'],
  ] as const)(
    'recusa %s cadastrado com a mesma mensagem de quem nao existe',
    async (_perfil, metodo, busca) => {
      const { servico, empresas, entregadores } = montar();
      const repositorio =
        busca === 'procurarPorEmail' ? empresas : entregadores;
      (repositorio[busca] as jest.Mock).mockResolvedValue({ senha: 'hash' });

      await expect(
        servico[metodo]({
          email: 'loja@example.com',
          cpf: CPF_FICTICIO,
          senha: 'x',
        }),
      ).rejects.toThrow('Credenciais invalidas');
    },
  );

  it('autentica a empresa com a senha certa', async () => {
    const { servico, empresas, senha } = montar();
    empresas.procurarPorEmail.mockResolvedValue({
      id_empresa: 7,
      nome_fantasia: 'Loja Teste',
      email: 'loja@example.com',
      senha: 'hash',
      sessao_versao: 0,
    });
    senha.verificar.mockResolvedValue(true);

    const resposta = await servico.loginEmpresa({
      email: 'loja@example.com',
      senha: 'x',
    });

    expect(resposta.usuario).toEqual(
      expect.objectContaining({ cargo: Cargo.ESTABELECIMENTO }),
    );
  });
});

describe('AuthService.minhasInformacoes', () => {
  it('devolve os dados da empresa logada, sem a senha', async () => {
    const { servico, empresas } = montar();
    empresas.procurarPorId.mockResolvedValue({
      id_empresa: 7,
      nome_fantasia: 'Loja Teste',
      email: 'loja@example.com',
      senha: 'hash',
    });

    const infos = await servico.minhasInformacoes({
      usuarioId: '7',
      cargo: Cargo.ESTABELECIMENTO,
    });

    expect(empresas.procurarPorId).toHaveBeenCalledWith(7);
    expect(infos).toEqual({
      id: 7,
      nomeFantasia: 'Loja Teste',
      email: 'loja@example.com',
      cargo: Cargo.ESTABELECIMENTO,
    });
  });

  it('devolve os dados do entregador com a situacao da senha temporaria', async () => {
    const { servico, entregadores } = montar();
    entregadores.procurarPorCpf.mockResolvedValue({
      cpf: CPF_FICTICIO,
      nome: 'Entregador Teste',
      senha: 'hash',
      senha_temporaria: true,
      senha_temporaria_expira_em: DAQUI_A_UM_DIA,
    });

    const infos = await servico.minhasInformacoes({
      usuarioId: CPF_FICTICIO,
      cargo: Cargo.ENTREGADOR,
    });

    expect(infos).toEqual({
      cpf: CPF_FICTICIO,
      nome: 'Entregador Teste',
      cargo: Cargo.ENTREGADOR,
      senhaTemporaria: true,
      senhaTemporariaExpiraEm: DAQUI_A_UM_DIA,
    });
  });

  it.each([
    ['empresa', { usuarioId: '7', cargo: Cargo.ESTABELECIMENTO }],
    ['entregador', { usuarioId: CPF_FICTICIO, cargo: Cargo.ENTREGADOR }],
  ])('recusa token de %s que nao existe mais', async (_perfil, usuario) => {
    const { servico } = montar();

    await expect(servico.minhasInformacoes(usuario)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});

describe('AuthService login com senha temporaria expirada', () => {
  it('recusa mesmo com a senha certa', async () => {
    const { servico, entregadores, senha, jwt } = montar();
    entregadores.procurarPorCpf.mockResolvedValue({
      cpf: CPF_FICTICIO,
      senha: 'hash',
      senha_temporaria: true,
      senha_temporaria_expira_em: ONTEM,
    });
    senha.verificar.mockResolvedValue(true);

    await expect(
      servico.loginEntregador({ cpf: CPF_FICTICIO, senha: 'x' }),
    ).rejects.toThrow(/expirada/);
    expect(jwt.sign).not.toHaveBeenCalled();
  });

  it('recusa senha temporaria sem prazo gravado', async () => {
    const { servico, entregadores, senha } = montar();
    entregadores.procurarPorCpf.mockResolvedValue({
      cpf: CPF_FICTICIO,
      senha: 'hash',
      senha_temporaria: true,
      senha_temporaria_expira_em: null,
    });
    senha.verificar.mockResolvedValue(true);

    await expect(
      servico.loginEntregador({ cpf: CPF_FICTICIO, senha: 'x' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('ignora o prazo de quem ja criou a propria senha', async () => {
    const { servico, entregadores, senha } = montar();
    entregadores.procurarPorCpf.mockResolvedValue({
      cpf: CPF_FICTICIO,
      nome: 'Entregador Teste',
      senha: 'hash',
      senha_temporaria: false,
      senha_temporaria_expira_em: null,
      sessao_versao: 0,
    });
    senha.verificar.mockResolvedValue(true);

    await expect(
      servico.loginEntregador({ cpf: CPF_FICTICIO, senha: 'x' }),
    ).resolves.toBeDefined();
  });
});

describe('AuthService.sairDeTodosOsAparelhos', () => {
  it('encerra as sessoes da empresa', async () => {
    const { servico, empresas, entregadores } = montar();

    await servico.sairDeTodosOsAparelhos({
      usuarioId: '7',
      cargo: Cargo.ESTABELECIMENTO,
      empresaId: '7',
    });

    expect(empresas.encerrarSessoes).toHaveBeenCalledWith(7);
    expect(entregadores.encerrarSessoes).not.toHaveBeenCalled();
  });

  it('encerra as sessoes do entregador', async () => {
    const { servico, empresas, entregadores } = montar();

    await servico.sairDeTodosOsAparelhos({
      usuarioId: CPF_FICTICIO,
      cargo: Cargo.ENTREGADOR,
    });

    expect(entregadores.encerrarSessoes).toHaveBeenCalledWith(CPF_FICTICIO);
    expect(empresas.encerrarSessoes).not.toHaveBeenCalled();
  });
});

describe('AuthService.trocarSenhaEntregador', () => {
  const usuario = { usuarioId: CPF_FICTICIO, cargo: Cargo.ENTREGADOR };
  const temporario = {
    cpf: CPF_FICTICIO,
    nome: 'Entregador Teste',
    senha: 'hash',
    senha_temporaria: true,
    senha_temporaria_expira_em: DAQUI_A_UM_DIA,
    sessao_versao: 0,
  };

  it('recusa token de entregador que nao existe mais', async () => {
    const { servico } = montar();

    await expect(
      servico.trocarSenhaEntregador(usuario, {
        senhaAtual: 'x',
        novaSenha: 'NovaSenha@1',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('recusa quando a senha atual nao confere, sem gravar', async () => {
    const { servico, entregadores, senha } = montar();
    entregadores.procurarPorCpf.mockResolvedValue(temporario);
    senha.comparar.mockResolvedValue(false);

    await expect(
      servico.trocarSenhaEntregador(usuario, {
        senhaAtual: 'errada',
        novaSenha: 'NovaSenha@1',
        cienteDadosCompartilhados: true,
      }),
    ).rejects.toThrow('Senha atual invalida');
    expect(entregadores.atualizarSenha).not.toHaveBeenCalled();
  });

  it('recusa trocar uma senha temporaria que ja expirou', async () => {
    const { servico, entregadores } = montar();
    entregadores.procurarPorCpf.mockResolvedValue({
      ...temporario,
      senha_temporaria_expira_em: ONTEM,
    });

    await expect(
      servico.trocarSenhaEntregador(usuario, {
        senhaAtual: 'Temp@2026',
        novaSenha: 'NovaSenha@1',
        cienteDadosCompartilhados: true,
      }),
    ).rejects.toThrow(/expirada/);
    expect(entregadores.atualizarSenha).not.toHaveBeenCalled();
  });

  it('recusa nova senha igual a atual', async () => {
    const { servico, entregadores } = montar();
    entregadores.procurarPorCpf.mockResolvedValue(temporario);

    await expect(
      servico.trocarSenhaEntregador(usuario, {
        senhaAtual: 'mesma-senha',
        novaSenha: 'mesma-senha',
        cienteDadosCompartilhados: true,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(entregadores.atualizarSenha).not.toHaveBeenCalled();
  });

  it('no primeiro acesso exige a ciencia dos dados compartilhados', async () => {
    const { servico, entregadores } = montar();
    entregadores.procurarPorCpf.mockResolvedValue(temporario);

    await expect(
      servico.trocarSenhaEntregador(usuario, {
        senhaAtual: 'Temp@2026',
        novaSenha: 'NovaSenha@1',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(entregadores.atualizarSenha).not.toHaveBeenCalled();
  });

  it('registra a data da ciencia no primeiro acesso', async () => {
    const { servico, entregadores } = montar();
    entregadores.procurarPorCpf.mockResolvedValue(temporario);

    const resposta = await servico.trocarSenhaEntregador(usuario, {
      senhaAtual: 'Temp@2026',
      novaSenha: 'NovaSenha@1',
      cienteDadosCompartilhados: true,
    });

    expect(entregadores.atualizarSenha).toHaveBeenCalledWith(
      CPF_FICTICIO,
      'hash',
      expect.any(Date),
    );
    expect(resposta.usuario.senhaTemporaria).toBe(false);
  });

  it('emite o token novo com a versao de sessao ja incrementada', async () => {
    const { servico, entregadores, jwt } = montar();
    entregadores.procurarPorCpf.mockResolvedValue(temporario);

    await servico.trocarSenhaEntregador(usuario, {
      senhaAtual: 'Temp@2026',
      novaSenha: 'NovaSenha@1',
      cienteDadosCompartilhados: true,
    });

    expect(jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({ versao: 1, senhaTemporaria: false }),
    );
  });

  it('fora do primeiro acesso troca sem pedir a ciencia de novo', async () => {
    const { servico, entregadores } = montar();
    entregadores.procurarPorCpf.mockResolvedValue({
      ...temporario,
      senha_temporaria: false,
    });

    await servico.trocarSenhaEntregador(usuario, {
      senhaAtual: 'SenhaAntiga@1',
      novaSenha: 'NovaSenha@1',
    });

    expect(entregadores.atualizarSenha).toHaveBeenCalledWith(
      CPF_FICTICIO,
      'hash',
      undefined,
    );
  });
});
