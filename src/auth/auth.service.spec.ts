import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '../common/enums/user-role.enum';
import { EmpresaRepository } from '../empresa/empresa.repository';
import { EntregadorRepository } from '../entregador/entregador.repository';
import { AuthService } from './auth.service';
import { RegisterEstablishmentDto } from './dto/register-establishment.dto';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

const CPF_FICTICIO = '52998224725';

function montar() {
  const empresas = {
    findByEmail: jest.fn().mockResolvedValue(null),
    findByDocumento: jest.fn().mockResolvedValue(null),
    create: jest.fn(),
  };
  const entregadores = {
    findByCpf: jest.fn().mockResolvedValue(null),
    updateSenha: jest.fn().mockResolvedValue({}),
  };
  const jwt = {
    sign: jest.fn().mockReturnValue('token'),
    decode: jest.fn().mockReturnValue({ exp: 1_900_000_000 }),
  };
  const password = {
    hash: jest.fn().mockResolvedValue('hash'),
    compare: jest.fn().mockResolvedValue(true),
    verificar: jest.fn().mockResolvedValue(false),
  };
  const service = new AuthService(
    empresas as unknown as EmpresaRepository,
    entregadores as unknown as EntregadorRepository,
    jwt as unknown as JwtService,
    password,
  );
  return { service, empresas, entregadores, password };
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
} as RegisterEstablishmentDto;

describe('AuthService.registerEstablishment', () => {
  it('exige exatamente um documento', async () => {
    const { service } = montar();
    await expect(
      service.registerEstablishment({ ...cadastro, cnpj: undefined }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.registerEstablishment({ ...cadastro, cpf: CPF_FICTICIO }),
    ).rejects.toThrow(BadRequestException);
  });

  it('converte corrida no unique do banco em 409', async () => {
    const { service, empresas } = montar();
    empresas.create.mockRejectedValue({ code: 'P2002' });
    await expect(service.registerEstablishment(cadastro)).rejects.toThrow(
      ConflictException,
    );
  });
});

describe('AuthService login', () => {
  it('passa pelo bcrypt mesmo quando o e-mail nao existe', async () => {
    const { service, password } = montar();
    await expect(
      service.loginEmpresa({ email: 'nada@example.com', senha: 'x' }),
    ).rejects.toThrow(UnauthorizedException);
    expect(password.verificar).toHaveBeenCalledWith('x', undefined);
  });

  it('passa pelo bcrypt mesmo quando o CPF nao existe', async () => {
    const { service, password } = montar();
    await expect(
      service.loginEntregador({ cpf: CPF_FICTICIO, senha: 'x' }),
    ).rejects.toThrow(UnauthorizedException);
    expect(password.verificar).toHaveBeenCalledWith('x', undefined);
  });

  it('autentica entregador com senha correta', async () => {
    const { service, entregadores, password } = montar();
    entregadores.findByCpf.mockResolvedValue({
      cpf: CPF_FICTICIO,
      nome: 'Entregador Teste',
      senha: 'hash',
      senha_temporaria: true,
    });
    password.verificar.mockResolvedValue(true);

    const resposta = await service.loginEntregador({
      cpf: CPF_FICTICIO,
      senha: 'x',
    });

    expect(resposta.user).toEqual({
      cpf: CPF_FICTICIO,
      nome: 'Entregador Teste',
      role: UserRole.ENTREGADOR,
      senhaTemporaria: true,
    });
  });
});

describe('AuthService.trocarSenhaEntregador', () => {
  const usuario = { userId: CPF_FICTICIO, role: UserRole.ENTREGADOR };

  it('recusa nova senha igual a atual', async () => {
    const { service, entregadores } = montar();
    entregadores.findByCpf.mockResolvedValue({
      cpf: CPF_FICTICIO,
      senha: 'hash',
    });

    await expect(
      service.trocarSenhaEntregador(usuario, {
        senhaAtual: 'mesma-senha',
        novaSenha: 'mesma-senha',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(entregadores.updateSenha).not.toHaveBeenCalled();
  });
});
