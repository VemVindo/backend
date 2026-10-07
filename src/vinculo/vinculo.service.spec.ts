import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ContratoRepository } from '../contrato/contrato.repository';
import { EntregadorRepository } from '../entregador/entregador.repository';
import { VinculoService } from './vinculo.service';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

const CPF_FICTICIO = '52998224725';

function montar() {
  const entregadores = {
    procurarPorCpf: jest.fn().mockResolvedValue(null),
  };
  const contratos = {
    listarAbertosDoEntregador: jest.fn().mockResolvedValue([]),
    aceitar: jest.fn().mockResolvedValue(true),
    recusar: jest.fn().mockResolvedValue(true),
    encerrarPeloEntregador: jest.fn().mockResolvedValue(true),
  };
  const service = new VinculoService(
    entregadores as unknown as EntregadorRepository,
    contratos as unknown as ContratoRepository,
  );
  return { service, entregadores, contratos };
}

describe('VinculoService.dadosCompartilhados', () => {
  it('mostra ao entregador o mesmo objeto que a empresa recebe na frota', async () => {
    const { service, entregadores } = montar();
    entregadores.procurarPorCpf.mockResolvedValue({
      cpf: CPF_FICTICIO,
      nome: 'Entregador Teste',
      telefone: '61900000000',
      tipo_veiculo: 'CARRO',
      placa: 'XYZ9E87',
      disponivel: false,
      senha: 'hash',
    });

    await expect(service.dadosCompartilhados(CPF_FICTICIO)).resolves.toEqual({
      dados: {
        nome: 'Entregador Teste',
        cpf: CPF_FICTICIO,
        tipoVeiculo: 'CARRO',
        placa: 'XYZ9E87',
        disponivel: false,
      },
    });
  });

  it('recusa sessao de entregador que nao existe mais', async () => {
    const { service } = montar();
    await expect(service.dadosCompartilhados(CPF_FICTICIO)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});

describe('VinculoService.listar', () => {
  it('devolve convites e vinculos com o nome da empresa', async () => {
    const { service, contratos } = montar();
    const convidadoEm = new Date('2026-10-01T12:00:00Z');
    contratos.listarAbertosDoEntregador.mockResolvedValue([
      {
        id_contrato: 3,
        status: 'PENDENTE',
        data_inicio: convidadoEm,
        data_aceite: null,
        empresa: { nome_fantasia: 'Cantina Dona Marta' },
      },
    ]);

    await expect(service.listar(CPF_FICTICIO)).resolves.toEqual([
      {
        id: 3,
        empresa: 'Cantina Dona Marta',
        status: 'PENDENTE',
        convidadoEm,
        aceitoEm: null,
      },
    ]);
  });
});

describe('VinculoService respostas ao convite', () => {
  it('aceita e recusa so convites do proprio entregador', async () => {
    const { service, contratos } = montar();

    await service.aceitar(3, CPF_FICTICIO);
    await service.recusar(4, CPF_FICTICIO);

    expect(contratos.aceitar).toHaveBeenCalledWith(3, CPF_FICTICIO);
    expect(contratos.recusar).toHaveBeenCalledWith(4, CPF_FICTICIO);
  });

  it('responde 404 para convite de outro entregador ou ja respondido', async () => {
    const { service, contratos } = montar();
    contratos.aceitar.mockResolvedValue(false);
    contratos.recusar.mockResolvedValue(false);

    await expect(service.aceitar(3, CPF_FICTICIO)).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.recusar(3, CPF_FICTICIO)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('encerra vinculo ativo e responde 404 quando nao ha', async () => {
    const { service, contratos } = montar();

    await service.encerrar(5, CPF_FICTICIO);
    expect(contratos.encerrarPeloEntregador).toHaveBeenCalledWith(
      5,
      CPF_FICTICIO,
    );

    contratos.encerrarPeloEntregador.mockResolvedValue(false);
    await expect(service.encerrar(5, CPF_FICTICIO)).rejects.toThrow(
      NotFoundException,
    );
  });
});
