import { ConflictException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import type { UsuarioAutenticado } from '../auth/jwt.strategy';
import { Cargo } from '../common/enums/cargo.enum';
import { PrismaService } from '../prisma/prisma.service';
import { CadastroEmpresaController } from './cadastro-empresa.controller';
import { AtualizarCadastroDto } from './dto/atualizar-cadastro.dto';
import { DadosCadastrais, EmpresaRepository } from './empresa.repository';
import { EmpresaService } from './empresa.service';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

const CRIADA = new Date('2026-09-01T12:00:00Z');
const AGORA = new Date('2026-10-20T15:00:00Z');

const EMPRESA = {
  id_empresa: 3,
  nome_fantasia: 'Cantina Dona Marta',
  razao_social: 'Cantina Dona Marta Ltda',
  CNPJ: '11222333000181',
  cpf: null,
  email: 'contato@cantina.test',
  telefone: '61930000000',
  cep: '70000000',
  logradouro: 'SQN 210 Bloco K',
  numero: 10,
  complemento: null,
  bairro: 'Asa Norte',
  cidade: 'Brasilia',
  UF: 'DF',
  criada_em: CRIADA,
  cadastro_atualizado_em: CRIADA,
};

const DADOS: DadosCadastrais = {
  nomeFantasia: 'Cantina Dona Marta',
  email: 'contato@cantina.test',
  telefone: '61930000000',
  cep: '70000000',
  logradouro: 'SQN 210 Bloco K',
  numero: 10,
  complemento: null,
  bairro: 'Asa Norte',
  cidade: 'Brasilia',
  uf: 'DF',
};

function montar() {
  const repositorio = {
    procurarPorId: jest.fn().mockResolvedValue(EMPRESA),
    procurarPorEmail: jest.fn().mockResolvedValue(null),
    atualizarCadastro: jest
      .fn()
      .mockResolvedValue({ ...EMPRESA, cadastro_atualizado_em: AGORA }),
  };
  const servico = new EmpresaService(
    repositorio as unknown as EmpresaRepository,
  );
  return { servico, repositorio };
}

describe('EmpresaService.consultarCadastro', () => {
  it('mostra os dados cadastrais com o documento e as datas', async () => {
    const { servico } = montar();

    await expect(servico.consultarCadastro(3)).resolves.toEqual({
      nomeFantasia: 'Cantina Dona Marta',
      razaoSocial: 'Cantina Dona Marta Ltda',
      documento: { tipo: 'CNPJ', numero: '11222333000181' },
      email: 'contato@cantina.test',
      telefone: '61930000000',
      endereco: {
        cep: '70000000',
        logradouro: 'SQN 210 Bloco K',
        numero: 10,
        complemento: null,
        bairro: 'Asa Norte',
        cidade: 'Brasilia',
        uf: 'DF',
      },
      criadaEm: CRIADA,
      atualizadaEm: CRIADA,
    });
  });

  it('cadastro por CPF mostra o CPF como documento', async () => {
    const { servico, repositorio } = montar();
    repositorio.procurarPorId.mockResolvedValue({
      ...EMPRESA,
      CNPJ: null,
      razao_social: null,
      cpf: '52998224725',
    });

    const cadastro = await servico.consultarCadastro(3);

    expect(cadastro.documento).toEqual({ tipo: 'CPF', numero: '52998224725' });
    expect(cadastro.razaoSocial).toBeNull();
  });

  it('cadastro legado sem documento mostra CPF vazio em vez de quebrar', async () => {
    const { servico, repositorio } = montar();
    repositorio.procurarPorId.mockResolvedValue({
      ...EMPRESA,
      CNPJ: null,
      cpf: null,
    });

    const cadastro = await servico.consultarCadastro(3);

    expect(cadastro.documento).toEqual({ tipo: 'CPF', numero: '' });
  });

  it('responde 404 para empresa inexistente', async () => {
    const { servico, repositorio } = montar();
    repositorio.procurarPorId.mockResolvedValue(null);

    await expect(servico.consultarCadastro(3)).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('EmpresaService.atualizarCadastro', () => {
  it('grava os dados e a data da atualizacao', async () => {
    const { servico, repositorio } = montar();

    const resposta = await servico.atualizarCadastro(
      3,
      { ...DADOS, telefone: '61940000000' },
      AGORA,
    );

    expect(repositorio.atualizarCadastro).toHaveBeenCalledWith(
      3,
      { ...DADOS, telefone: '61940000000' },
      false,
      AGORA,
    );
    expect(resposta.atualizadaEm).toBe(AGORA);
  });

  it.each([
    ['cep', { cep: '70297400' }],
    ['numero', { numero: 11 }],
    ['uf', { uf: 'GO' }],
  ])(
    'mudar o %s pede nova geocodificacao da origem',
    async (_campo, mudanca) => {
      const { servico, repositorio } = montar();

      await servico.atualizarCadastro(3, { ...DADOS, ...mudanca }, AGORA);

      expect(repositorio.atualizarCadastro).toHaveBeenCalledWith(
        3,
        expect.anything(),
        true,
        AGORA,
      );
    },
  );

  it('recusa e-mail de outra empresa sem gravar', async () => {
    const { servico, repositorio } = montar();
    repositorio.procurarPorEmail.mockResolvedValue({
      ...EMPRESA,
      id_empresa: 9,
    });

    await expect(
      servico.atualizarCadastro(3, { ...DADOS, email: 'outra@empresa.test' }),
    ).rejects.toThrow(ConflictException);
    expect(repositorio.atualizarCadastro).not.toHaveBeenCalled();
  });

  it('manter o proprio e-mail nao consulta duplicidade', async () => {
    const { servico, repositorio } = montar();

    await servico.atualizarCadastro(3, DADOS, AGORA);

    expect(repositorio.procurarPorEmail).not.toHaveBeenCalled();
  });

  it('responde 409 quando outra empresa pega o e-mail ao mesmo tempo', async () => {
    const { servico, repositorio } = montar();
    repositorio.atualizarCadastro.mockRejectedValue({ code: 'P2002' });

    await expect(
      servico.atualizarCadastro(3, { ...DADOS, email: 'nova@cantina.test' }),
    ).rejects.toThrow(ConflictException);
  });

  it('repassa outros erros do banco', async () => {
    const { servico, repositorio } = montar();
    const falha = new Error('conexao perdida');
    repositorio.atualizarCadastro.mockRejectedValue(falha);

    await expect(servico.atualizarCadastro(3, DADOS)).rejects.toBe(falha);
  });

  it('responde 404 para empresa inexistente', async () => {
    const { servico, repositorio } = montar();
    repositorio.procurarPorId.mockResolvedValue(null);

    await expect(servico.atualizarCadastro(3, DADOS)).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('EmpresaRepository.atualizarCadastro', () => {
  function repositorio() {
    const prisma = { empresa: { update: jest.fn().mockResolvedValue({}) } };
    return {
      repo: new EmpresaRepository(prisma as unknown as PrismaService),
      prisma,
    };
  }

  it('grava os campos editaveis e a data, sem tocar no documento', async () => {
    const { repo, prisma } = repositorio();

    await repo.atualizarCadastro(3, DADOS, false, AGORA);

    expect(prisma.empresa.update).toHaveBeenCalledWith({
      where: { id_empresa: 3 },
      data: {
        nome_fantasia: 'Cantina Dona Marta',
        email: 'contato@cantina.test',
        telefone: '61930000000',
        cep: '70000000',
        logradouro: 'SQN 210 Bloco K',
        numero: 10,
        complemento: null,
        bairro: 'Asa Norte',
        cidade: 'Brasilia',
        UF: 'DF',
        cadastro_atualizado_em: AGORA,
      },
    });
  });

  it('com endereco novo apaga a coordenada antiga da origem', async () => {
    const { repo, prisma } = repositorio();

    await repo.atualizarCadastro(3, DADOS, true, AGORA);

    const [{ data }] = prisma.empresa.update.mock.calls[0] as [
      { data: Record<string, unknown> },
    ];
    expect(data).toMatchObject({ origem_lat: null, origem_lng: null });
  });
});

describe('CadastroEmpresaController', () => {
  const usuario: UsuarioAutenticado = {
    usuarioId: '3',
    cargo: Cargo.ESTABELECIMENTO,
    empresaId: '3',
  };

  it('usa a empresa do token, nunca um id vindo do corpo', async () => {
    const servico = {
      consultarCadastro: jest.fn().mockResolvedValue({}),
      atualizarCadastro: jest.fn().mockResolvedValue({}),
    };
    const controlador = new CadastroEmpresaController(
      servico as unknown as EmpresaService,
    );

    await controlador.consultar(usuario);
    await controlador.atualizar(usuario, { ...DADOS, complemento: undefined });

    expect(servico.consultarCadastro).toHaveBeenCalledWith(3);
    expect(servico.atualizarCadastro).toHaveBeenCalledWith(3, DADOS);
  });
});

describe('AtualizarCadastroDto', () => {
  function campos(dados: object) {
    const dto = plainToInstance(AtualizarCadastroDto, { ...DADOS, ...dados });
    return validateSync(dto, { whitelist: true }).map((e) => e.property);
  }

  it('aceita os dados validos e normaliza o e-mail', () => {
    const dto = plainToInstance(AtualizarCadastroDto, {
      ...DADOS,
      email: ' Contato@Cantina.TEST ',
      complemento: undefined,
    });
    expect(validateSync(dto)).toEqual([]);
    expect(dto.email).toBe('contato@cantina.test');
  });

  it('aplica as validacoes do cadastro', () => {
    expect(
      campos({ email: 'invalido', telefone: '123', cep: '7000', uf: 'XX' }),
    ).toEqual(['email', 'telefone', 'cep', 'uf']);
  });

  it('nao aceita documento nem razao social', () => {
    const dto = plainToInstance(AtualizarCadastroDto, {
      ...DADOS,
      cnpj: '11222333000181',
      razaoSocial: 'Outra',
    });
    validateSync(dto, { whitelist: true });
    expect(dto).not.toHaveProperty('cnpj');
    expect(dto).not.toHaveProperty('razaoSocial');
  });
});
