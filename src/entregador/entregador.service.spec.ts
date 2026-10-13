import { ConflictException, NotFoundException } from '@nestjs/common';
import { TipoVeiculo } from '../common/enums/tipo-veiculo.enum';
import { SenhaService } from '../common/security/senha.service';
import { ContratoRepository } from '../contrato/contrato.repository';
import { CadastrarEntregadorDto } from './dto/cadastrar-entregador.dto';
import { EntregadorRepository } from './entregador.repository';
import { EntregadorService, MENSAGEM_CONVITE } from './entregador.service';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

const CPF_FICTICIO = '52998224725';
const ID_EMPRESA = 1;

const entregadorSalvo = {
  cpf: CPF_FICTICIO,
  nome: 'Entregador Teste',
  telefone: '61900000000',
  tipo_veiculo: 'MOTO',
  placa: 'ABC1D23',
  disponivel: true,
  senha: 'hash',
  senha_temporaria: false,
  ciencia_dados_em: null,
};

function montar() {
  const entregadores = {
    procurarPorCpf: jest.fn().mockResolvedValue(null),
    procurarAtivosPorEmpresa: jest.fn().mockResolvedValue([]),
    redefinirSenhaTemporaria: jest.fn().mockResolvedValue(true),
    criarComConvite: jest.fn(
      (dados: { cpf: string; nome: string; placa: string | null }) =>
        Promise.resolve({
          cpf: dados.cpf,
          nome: dados.nome,
          tipo_veiculo: 'MOTO',
          placa: dados.placa,
        }),
    ),
  };
  const contratos = {
    criarConvite: jest.fn().mockResolvedValue({}),
    encerrarPelaEmpresa: jest.fn().mockResolvedValue(true),
    primeiroDoEntregador: jest.fn().mockResolvedValue(null),
  };
  const senha = { hash: jest.fn().mockResolvedValue('hash') };
  const service = new EntregadorService(
    entregadores as unknown as EntregadorRepository,
    contratos as unknown as ContratoRepository,
    senha as unknown as SenhaService,
  );
  return { service, entregadores, contratos };
}

const dto: CadastrarEntregadorDto = {
  nome: 'Entregador Teste',
  cpf: CPF_FICTICIO,
  telefone: '61900000000',
  tipoVeiculo: TipoVeiculo.MOTO,
  placa: 'ABC1D23',
};

describe('EntregadorService.cadastrar', () => {
  it('cria o entregador com convite pendente e devolve a senha temporaria', async () => {
    const { service, entregadores } = montar();

    const resultado = await service.cadastrar(ID_EMPRESA, dto);

    expect(entregadores.criarComConvite).toHaveBeenCalledWith(
      expect.objectContaining({
        cpf: CPF_FICTICIO,
        senhaHash: 'hash',
        senhaTemporariaExpiraEm: resultado.senhaTemporariaExpiraEm,
      }),
      ID_EMPRESA,
    );
    expect(resultado.status).toBe('PENDENTE');
    expect(resultado.senhaTemporaria).toMatch(/^[\w-]{12}$/);
    const horas =
      (resultado.senhaTemporariaExpiraEm.getTime() - Date.now()) / 3_600_000;
    expect(horas).toBeGreaterThan(47.9);
    expect(horas).toBeLessThanOrEqual(48);
  });

  it('descarta placa enviada para bicicleta', async () => {
    const { service, entregadores } = montar();

    await service.cadastrar(ID_EMPRESA, {
      ...dto,
      tipoVeiculo: TipoVeiculo.BICICLETA,
    });

    expect(entregadores.criarComConvite).toHaveBeenCalledWith(
      expect.objectContaining({ placa: null }),
      ID_EMPRESA,
    );
  });

  it('recusa CPF ja cadastrado', async () => {
    const { service, entregadores } = montar();
    entregadores.procurarPorCpf.mockResolvedValue({ cpf: CPF_FICTICIO });

    await expect(service.cadastrar(ID_EMPRESA, dto)).rejects.toThrow(
      ConflictException,
    );
    expect(entregadores.criarComConvite).not.toHaveBeenCalled();
  });

  it('converte corrida no unique do banco em 409', async () => {
    const { service, entregadores } = montar();
    entregadores.criarComConvite.mockRejectedValue({ code: 'P2002' });

    await expect(service.cadastrar(ID_EMPRESA, dto)).rejects.toThrow(
      ConflictException,
    );
  });
});

describe('EntregadorService.convidar', () => {
  it('responde igual para CPF inexistente, sem criar convite', async () => {
    const { service, contratos } = montar();

    await expect(service.convidar(ID_EMPRESA, CPF_FICTICIO)).resolves.toEqual({
      mensagem: MENSAGEM_CONVITE,
    });
    expect(contratos.criarConvite).not.toHaveBeenCalled();
  });

  it('cria convite pendente para CPF cadastrado, sem devolver dados pessoais', async () => {
    const { service, entregadores, contratos } = montar();
    entregadores.procurarPorCpf.mockResolvedValue(entregadorSalvo);

    const resposta = await service.convidar(ID_EMPRESA, CPF_FICTICIO);

    expect(contratos.criarConvite).toHaveBeenCalledWith(
      ID_EMPRESA,
      CPF_FICTICIO,
    );
    expect(resposta).toEqual({ mensagem: MENSAGEM_CONVITE });
  });

  it('responde igual quando ja existe convite ou vinculo em aberto', async () => {
    const { service, entregadores, contratos } = montar();
    entregadores.procurarPorCpf.mockResolvedValue(entregadorSalvo);
    contratos.criarConvite.mockRejectedValue({ code: 'P2002' });

    await expect(service.convidar(ID_EMPRESA, CPF_FICTICIO)).resolves.toEqual({
      mensagem: MENSAGEM_CONVITE,
    });
  });

  it('propaga erro que nao e de unicidade', async () => {
    const { service, entregadores, contratos } = montar();
    entregadores.procurarPorCpf.mockResolvedValue(entregadorSalvo);
    contratos.criarConvite.mockRejectedValue(new Error('banco fora'));

    await expect(service.convidar(ID_EMPRESA, CPF_FICTICIO)).rejects.toThrow(
      'banco fora',
    );
  });
});

describe('EntregadorService.listarFrota', () => {
  it('devolve so os dados visiveis para a empresa', async () => {
    const { service, entregadores } = montar();
    entregadores.procurarAtivosPorEmpresa.mockResolvedValue([entregadorSalvo]);

    await expect(service.listarFrota(ID_EMPRESA)).resolves.toEqual([
      {
        nome: 'Entregador Teste',
        cpf: CPF_FICTICIO,
        tipoVeiculo: 'MOTO',
        placa: 'ABC1D23',
        disponivel: true,
      },
    ]);
  });
});

describe('EntregadorService.desvincular', () => {
  it('encerra o vinculo ativo da empresa', async () => {
    const { service, contratos } = montar();

    await service.desvincular(ID_EMPRESA, CPF_FICTICIO);

    expect(contratos.encerrarPelaEmpresa).toHaveBeenCalledWith(
      ID_EMPRESA,
      CPF_FICTICIO,
    );
  });

  it('responde 404 sem vinculo ativo', async () => {
    const { service, contratos } = montar();
    contratos.encerrarPelaEmpresa.mockResolvedValue(false);

    await expect(service.desvincular(ID_EMPRESA, CPF_FICTICIO)).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('EntregadorService.gerarNovaSenhaTemporaria', () => {
  const OUTRA_EMPRESA = 2;
  const aguardandoPrimeiroAcesso = {
    ...entregadorSalvo,
    senha_temporaria: true,
  };

  function cadastradoPor(idEmpresa: number, status = 'PENDENTE') {
    return { id_contrato: 1, idEmpresa, status };
  }

  it('gera outra senha com novo prazo para quem cadastrou o entregador', async () => {
    const { service, entregadores, contratos } = montar();
    entregadores.procurarPorCpf.mockResolvedValue(aguardandoPrimeiroAcesso);
    contratos.primeiroDoEntregador.mockResolvedValue(cadastradoPor(ID_EMPRESA));

    const resultado = await service.gerarNovaSenhaTemporaria(
      ID_EMPRESA,
      CPF_FICTICIO,
    );

    expect(resultado.senhaTemporaria).toMatch(/^[\w-]{12}$/);
    expect(entregadores.redefinirSenhaTemporaria).toHaveBeenCalledWith(
      CPF_FICTICIO,
      'hash',
      resultado.senhaTemporariaExpiraEm,
    );
  });

  it('recusa empresa que so convidou o entregador depois', async () => {
    const { service, entregadores, contratos } = montar();
    entregadores.procurarPorCpf.mockResolvedValue(aguardandoPrimeiroAcesso);
    contratos.primeiroDoEntregador.mockResolvedValue(cadastradoPor(ID_EMPRESA));

    await expect(
      service.gerarNovaSenhaTemporaria(OUTRA_EMPRESA, CPF_FICTICIO),
    ).rejects.toThrow(NotFoundException);
    expect(entregadores.redefinirSenhaTemporaria).not.toHaveBeenCalled();
  });

  it('recusa quando o entregador ja criou a propria senha', async () => {
    const { service, entregadores, contratos } = montar();
    entregadores.procurarPorCpf.mockResolvedValue(entregadorSalvo);
    contratos.primeiroDoEntregador.mockResolvedValue(cadastradoPor(ID_EMPRESA));

    await expect(
      service.gerarNovaSenhaTemporaria(ID_EMPRESA, CPF_FICTICIO),
    ).rejects.toThrow(NotFoundException);
    expect(entregadores.redefinirSenhaTemporaria).not.toHaveBeenCalled();
  });

  it('recusa quando o vinculo com quem cadastrou ja foi encerrado', async () => {
    const { service, entregadores, contratos } = montar();
    entregadores.procurarPorCpf.mockResolvedValue(aguardandoPrimeiroAcesso);
    contratos.primeiroDoEntregador.mockResolvedValue(
      cadastradoPor(ID_EMPRESA, 'ENCERRADO'),
    );

    await expect(
      service.gerarNovaSenhaTemporaria(ID_EMPRESA, CPF_FICTICIO),
    ).rejects.toThrow(NotFoundException);
  });

  it('responde igual para CPF inexistente', async () => {
    const { service } = montar();

    await expect(
      service.gerarNovaSenhaTemporaria(ID_EMPRESA, CPF_FICTICIO),
    ).rejects.toThrow(NotFoundException);
  });

  it('recusa se o entregador criou a senha no meio da operacao', async () => {
    const { service, entregadores, contratos } = montar();
    entregadores.procurarPorCpf.mockResolvedValue(aguardandoPrimeiroAcesso);
    contratos.primeiroDoEntregador.mockResolvedValue(cadastradoPor(ID_EMPRESA));
    entregadores.redefinirSenhaTemporaria.mockResolvedValue(false);

    await expect(
      service.gerarNovaSenhaTemporaria(ID_EMPRESA, CPF_FICTICIO),
    ).rejects.toThrow(NotFoundException);
  });
});
