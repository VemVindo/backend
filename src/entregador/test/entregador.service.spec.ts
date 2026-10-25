import { ConflictException, NotFoundException } from '@nestjs/common';
import { TipoVeiculo } from '../../common/enums/tipo-veiculo.enum';
import { SenhaService } from '../../common/security/senha.service';
import { ContratoRepository } from '../../contrato/contrato.repository';
import { LocalizacaoService } from '../../mapa/localizacao.service';
import { PedidoAlteradoError } from '../../pedido/pedido.erros';
import { CadastrarEntregadorDto } from '../dto/cadastrar-entregador.dto';
import { EntregadorRepository } from '../entregador.repository';
import { EntregadorService, MENSAGEM_CONVITE } from '../entregador.service';
import { RemocaoDaFrotaRepository } from '../remocao-da-frota.repository';
import { Test, TestingModule } from '@nestjs/testing';
import { EditarEntregadorReqDto } from '../dto/editar-entregador.dto';

jest.mock('../../prisma/prisma.service', () => ({ PrismaService: class {} }));

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
    primeiroDoEntregador: jest.fn().mockResolvedValue(null),
  };
  const senha = { hash: jest.fn().mockResolvedValue('hash') };
  const remocao = {
    remover: jest.fn().mockResolvedValue({ reatribuidos: [], pendentes: [] }),
  };
  const localizacao = {
    aoTrocarEntregador: jest.fn().mockResolvedValue(undefined),
    aoMudarStatus: jest.fn().mockResolvedValue(undefined),
  };
  const service = new EntregadorService(
    entregadores as unknown as EntregadorRepository,
    contratos as unknown as ContratoRepository,
    senha as unknown as SenhaService,
    remocao as unknown as RemocaoDaFrotaRepository,
    localizacao as unknown as LocalizacaoService,
  );
  return { service, entregadores, contratos, remocao, localizacao };
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
        telefone: '61900000000',
        tipoVeiculo: 'MOTO',
        placa: 'ABC1D23',
        disponivel: true,
      },
    ]);
  });
});

describe('EntregadorService.desvincular', () => {
  it('encerra o vinculo da empresa e devolve o resultado da reatribuicao', async () => {
    const { service, remocao } = montar();
    const resultado = {
      reatribuidos: [
        { idPedido: 10, entregador: { cpf: '11144477735', nome: 'Ana' } },
      ],
      pendentes: [{ idPedido: 11 }],
    };
    remocao.remover.mockResolvedValue(resultado);

    await expect(service.desvincular(ID_EMPRESA, CPF_FICTICIO)).resolves.toBe(
      resultado,
    );
    expect(remocao.remover).toHaveBeenCalledWith(ID_EMPRESA, CPF_FICTICIO);
  });

  it('reinicia o rastreio dos pedidos que trocaram de entregador', async () => {
    const { service, remocao, localizacao } = montar();
    remocao.remover.mockResolvedValue({
      reatribuidos: [
        { idPedido: 10, entregador: { cpf: '11144477735', nome: 'Ana' } },
      ],
      pendentes: [],
    });

    await service.desvincular(ID_EMPRESA, CPF_FICTICIO);

    expect(localizacao.aoTrocarEntregador).toHaveBeenCalledWith(10);
    expect(localizacao.aoMudarStatus).not.toHaveBeenCalled();
  });

  it('avisa o rastreio que o pedido sem entregador voltou para PENDENTE', async () => {
    const { service, remocao, localizacao } = montar();
    remocao.remover.mockResolvedValue({
      reatribuidos: [],
      pendentes: [{ idPedido: 11 }],
    });

    await service.desvincular(ID_EMPRESA, CPF_FICTICIO);

    expect(localizacao.aoTrocarEntregador).toHaveBeenCalledWith(11);
    expect(localizacao.aoMudarStatus).toHaveBeenCalledWith(11, 'PENDENTE');
  });

  it('responde 404 sem vinculo ativo', async () => {
    const { service, remocao, localizacao } = montar();
    remocao.remover.mockResolvedValue(null);

    await expect(service.desvincular(ID_EMPRESA, CPF_FICTICIO)).rejects.toThrow(
      NotFoundException,
    );
    expect(localizacao.aoTrocarEntregador).not.toHaveBeenCalled();
  });

  it('responde 409 se um pedido mudou durante a remocao', async () => {
    const { service, remocao } = montar();
    remocao.remover.mockRejectedValue(new PedidoAlteradoError());

    await expect(service.desvincular(ID_EMPRESA, CPF_FICTICIO)).rejects.toThrow(
      ConflictException,
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

describe('EntregadorService.editar', () => {
  let service: EntregadorService;
  let repository: EntregadorRepository;
  let mock1: jest.Mock;
  let mock2: jest.Mock;
  beforeEach(async () => {
    mock1 = jest.fn();
    mock2 = jest.fn();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EntregadorService,
        {
          provide: ContratoRepository,
          useValue: {},
        },
        {
          provide: SenhaService,
          useValue: {},
        },
        {
          provide: RemocaoDaFrotaRepository,
          useValue: {},
        },
        {
          provide: LocalizacaoService,
          useValue: {},
        },
        {
          provide: EntregadorRepository,
          useValue: {
            procurarAtivoPorEmpresa: mock1,
            atualizar: mock2,
          },
        },
      ],
    }).compile();
    service = module.get<EntregadorService>(EntregadorService);
    repository = module.get<EntregadorRepository>(EntregadorRepository);
  });

  it('CAIXA PRETA: Entrada inválidas retorna false', async () => {
    const stub = {
      nome: null,
      veiculo: null,
      telefone: null,
      placa: null,
      cpf: {} as string,
    } as EditarEntregadorReqDto;

    const dummyIdEmpresa = {} as number;

    const result = await service.editar(dummyIdEmpresa, stub);
    expect(result).toBe(false);
  });

  it('CAIXA CINZA: Vinculo empresa entregador inexistente', async () => {
    mock1.mockResolvedValue(false);
    const dummyDto = {
      nome: {} as string,
      veiculo: {} as string,
      telefone: {} as string,
      placa: {} as string,
      cpf: {} as string,
    } as EditarEntregadorReqDto;

    const dummyIdEmpresa = {} as number;
    const spy = jest.spyOn(repository, 'procurarAtivoPorEmpresa');
    const result = await service.editar(dummyIdEmpresa, dummyDto);
    expect(result).toBe(false);
    expect(spy).toHaveBeenCalledWith(dummyIdEmpresa, dummyDto.cpf);
  });

  it('CAIXA CINZA: Atualizacao bem sucedida', async () => {
    mock1.mockResolvedValue(true);
    mock2.mockResolvedValue(true);
    const dummyDto = {
      nome: {} as string,
      veiculo: {} as string,
      telefone: {} as string,
      placa: {} as string,
      cpf: {} as string,
    } as EditarEntregadorReqDto;

    const dummyIdEmpresa = {} as number;
    const spy = jest.spyOn(repository, 'procurarAtivoPorEmpresa');
    const result = await service.editar(dummyIdEmpresa, dummyDto);
    expect(result).toBe(true);
    expect(spy).toHaveBeenCalledWith(dummyIdEmpresa, dummyDto.cpf);
  });

  it('CAIXA CINZA: Atualizacao mal sucedida', async () => {
    mock1.mockResolvedValue(true);
    mock2.mockResolvedValue(false);
    const dummyDto = {
      nome: {} as string,
      veiculo: {} as string,
      telefone: {} as string,
      placa: {} as string,
      cpf: {} as string,
    } as EditarEntregadorReqDto;

    const dummyIdEmpresa = {} as number;
    const spy = jest.spyOn(repository, 'procurarAtivoPorEmpresa');
    const result = await service.editar(dummyIdEmpresa, dummyDto);
    expect(result).toBe(false);
    expect(spy).toHaveBeenCalledWith(dummyIdEmpresa, dummyDto.cpf);
  });
});
