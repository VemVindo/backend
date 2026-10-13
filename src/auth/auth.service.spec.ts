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
  const service = new AuthService(
    empresas as unknown as EmpresaRepository,
    entregadores as unknown as EntregadorRepository,
    jwt as unknown as JwtService,
    senha,
  );
  return { service, empresas, entregadores, jwt, senha };
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
    const { service } = montar();
    await expect(
      service.cadastrarEmpresa({ ...cadastro, cnpj: undefined }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.cadastrarEmpresa({ ...cadastro, cpf: CPF_FICTICIO }),
    ).rejects.toThrow(BadRequestException);
  });

  it('converte corrida no unique do banco em 409', async () => {
    const { service, empresas } = montar();
    empresas.criar.mockRejectedValue({ code: 'P2002' });
    await expect(service.cadastrarEmpresa(cadastro)).rejects.toThrow(
      ConflictException,
    );
  });

  it('assina o token com cargo, empresaId e versao da sessao', async () => {
    const { service, empresas, jwt } = montar();
    empresas.criar.mockResolvedValue({
      id_empresa: 7,
      nome_fantasia: 'Loja Teste',
      email: 'loja@example.com',
      sessao_versao: 0,
    });

    const resposta = await service.cadastrarEmpresa(cadastro);

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
    const { service, senha } = montar();
    await expect(
      service.loginEmpresa({ email: 'nada@example.com', senha: 'x' }),
    ).rejects.toThrow(UnauthorizedException);
    expect(senha.verificar).toHaveBeenCalledWith('x', undefined);
  });

  it('passa pelo bcrypt mesmo quando o CPF nao existe', async () => {
    const { service, senha } = montar();
    await expect(
      service.loginEntregador({ cpf: CPF_FICTICIO, senha: 'x' }),
    ).rejects.toThrow(UnauthorizedException);
    expect(senha.verificar).toHaveBeenCalledWith('x', undefined);
  });

  it('autentica entregador com senha temporaria dentro do prazo', async () => {
    const { service, entregadores, senha, jwt } = montar();
    entregadores.procurarPorCpf.mockResolvedValue({
      cpf: CPF_FICTICIO,
      nome: 'Entregador Teste',
      senha: 'hash',
      senha_temporaria: true,
      senha_temporaria_expira_em: DAQUI_A_UM_DIA,
      sessao_versao: 3,
    });
    senha.verificar.mockResolvedValue(true);

    const resposta = await service.loginEntregador({
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

describe('AuthService login com senha temporaria expirada', () => {
  it('recusa mesmo com a senha certa', async () => {
    const { service, entregadores, senha, jwt } = montar();
    entregadores.procurarPorCpf.mockResolvedValue({
      cpf: CPF_FICTICIO,
      senha: 'hash',
      senha_temporaria: true,
      senha_temporaria_expira_em: ONTEM,
    });
    senha.verificar.mockResolvedValue(true);

    await expect(
      service.loginEntregador({ cpf: CPF_FICTICIO, senha: 'x' }),
    ).rejects.toThrow(/expirada/);
    expect(jwt.sign).not.toHaveBeenCalled();
  });

  it('recusa senha temporaria sem prazo gravado', async () => {
    const { service, entregadores, senha } = montar();
    entregadores.procurarPorCpf.mockResolvedValue({
      cpf: CPF_FICTICIO,
      senha: 'hash',
      senha_temporaria: true,
      senha_temporaria_expira_em: null,
    });
    senha.verificar.mockResolvedValue(true);

    await expect(
      service.loginEntregador({ cpf: CPF_FICTICIO, senha: 'x' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('ignora o prazo de quem ja criou a propria senha', async () => {
    const { service, entregadores, senha } = montar();
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
      service.loginEntregador({ cpf: CPF_FICTICIO, senha: 'x' }),
    ).resolves.toBeDefined();
  });
});

describe('AuthService.sairDeTodosOsAparelhos', () => {
  it('encerra as sessoes da empresa', async () => {
    const { service, empresas, entregadores } = montar();

    await service.sairDeTodosOsAparelhos({
      usuarioId: '7',
      cargo: Cargo.ESTABELECIMENTO,
      empresaId: '7',
    });

    expect(empresas.encerrarSessoes).toHaveBeenCalledWith(7);
    expect(entregadores.encerrarSessoes).not.toHaveBeenCalled();
  });

  it('encerra as sessoes do entregador', async () => {
    const { service, empresas, entregadores } = montar();

    await service.sairDeTodosOsAparelhos({
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

  it('recusa trocar uma senha temporaria que ja expirou', async () => {
    const { service, entregadores } = montar();
    entregadores.procurarPorCpf.mockResolvedValue({
      ...temporario,
      senha_temporaria_expira_em: ONTEM,
    });

    await expect(
      service.trocarSenhaEntregador(usuario, {
        senhaAtual: 'Temp@2026',
        novaSenha: 'NovaSenha@1',
        cienteDadosCompartilhados: true,
      }),
    ).rejects.toThrow(/expirada/);
    expect(entregadores.atualizarSenha).not.toHaveBeenCalled();
  });

  it('recusa nova senha igual a atual', async () => {
    const { service, entregadores } = montar();
    entregadores.procurarPorCpf.mockResolvedValue(temporario);

    await expect(
      service.trocarSenhaEntregador(usuario, {
        senhaAtual: 'mesma-senha',
        novaSenha: 'mesma-senha',
        cienteDadosCompartilhados: true,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(entregadores.atualizarSenha).not.toHaveBeenCalled();
  });

  it('no primeiro acesso exige a ciencia dos dados compartilhados', async () => {
    const { service, entregadores } = montar();
    entregadores.procurarPorCpf.mockResolvedValue(temporario);

    await expect(
      service.trocarSenhaEntregador(usuario, {
        senhaAtual: 'Temp@2026',
        novaSenha: 'NovaSenha@1',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(entregadores.atualizarSenha).not.toHaveBeenCalled();
  });

  it('registra a data da ciencia no primeiro acesso', async () => {
    const { service, entregadores } = montar();
    entregadores.procurarPorCpf.mockResolvedValue(temporario);

    const resposta = await service.trocarSenhaEntregador(usuario, {
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
    const { service, entregadores, jwt } = montar();
    entregadores.procurarPorCpf.mockResolvedValue(temporario);

    await service.trocarSenhaEntregador(usuario, {
      senhaAtual: 'Temp@2026',
      novaSenha: 'NovaSenha@1',
      cienteDadosCompartilhados: true,
    });

    expect(jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({ versao: 1, senhaTemporaria: false }),
    );
  });

  it('fora do primeiro acesso troca sem pedir a ciencia de novo', async () => {
    const { service, entregadores } = montar();
    entregadores.procurarPorCpf.mockResolvedValue({
      ...temporario,
      senha_temporaria: false,
    });

    await service.trocarSenhaEntregador(usuario, {
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
