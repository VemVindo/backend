import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TipoVeiculo } from '../../common/enums/tipo-veiculo.enum';
import { EntregadorRepository } from '../entregador.repository';
import {
  MENSAGEM_PLACA_OBRIGATORIA,
  PerfilEntregadorService,
} from '../perfil-entregador.service';

jest.mock('../../prisma/prisma.service', () => ({ PrismaService: class {} }));

const CPF_FICTICIO = '52998224725';

const salvo = {
  cpf: CPF_FICTICIO,
  nome: 'Entregador Teste',
  telefone: '61900000000',
  tipo_veiculo: 'MOTO',
  placa: 'ABC1D23',
  disponivel: true,
  senha: 'hash',
  senha_temporaria: false,
};

function montar(atual: object | null = salvo) {
  const entregadores = {
    procurarPorCpf: jest.fn().mockResolvedValue(atual),
    atualizarPerfil: jest.fn((_cpf: string, dados: object) =>
      Promise.resolve({ ...salvo, ...dados }),
    ),
  };
  const servico = new PerfilEntregadorService(
    entregadores as unknown as EntregadorRepository,
  );
  return { servico, entregadores };
}

describe('PerfilEntregadorService.consultar', () => {
  it('devolve so os dados do cadastro, sem senha nem disponibilidade', async () => {
    const { servico, entregadores } = montar();

    await expect(servico.consultar(CPF_FICTICIO)).resolves.toEqual({
      nome: 'Entregador Teste',
      cpf: CPF_FICTICIO,
      telefone: '61900000000',
      tipoVeiculo: 'MOTO',
      placa: 'ABC1D23',
    });
    expect(entregadores.procurarPorCpf).toHaveBeenCalledWith(CPF_FICTICIO);
  });

  it('responde 404 quando o entregador do token nao existe mais', async () => {
    const { servico } = montar(null);

    await expect(servico.consultar(CPF_FICTICIO)).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('PerfilEntregadorService.editar', () => {
  it('grava so os campos enviados e mantem veiculo e placa atuais', async () => {
    const { servico, entregadores } = montar();

    await expect(
      servico.editar(CPF_FICTICIO, { telefone: '61988887777' }),
    ).resolves.toMatchObject({ telefone: '61988887777', placa: 'ABC1D23' });
    expect(entregadores.atualizarPerfil).toHaveBeenCalledWith(CPF_FICTICIO, {
      nome: undefined,
      telefone: '61988887777',
      tipo_veiculo: 'MOTO',
      placa: 'ABC1D23',
    });
  });

  it('troca a placa e o veiculo juntos', async () => {
    const { servico, entregadores } = montar();

    await servico.editar(CPF_FICTICIO, {
      nome: 'Outro Nome',
      tipoVeiculo: TipoVeiculo.CARRO,
      placa: 'XYZ9876',
    });

    expect(entregadores.atualizarPerfil).toHaveBeenCalledWith(CPF_FICTICIO, {
      nome: 'Outro Nome',
      telefone: undefined,
      tipo_veiculo: 'CARRO',
      placa: 'XYZ9876',
    });
  });

  it('ao passar para bicicleta apaga a placa, mesmo se ela vier no corpo', async () => {
    const { servico, entregadores } = montar();

    await expect(
      servico.editar(CPF_FICTICIO, {
        tipoVeiculo: TipoVeiculo.BICICLETA,
        placa: 'XYZ9876',
      }),
    ).resolves.toMatchObject({ tipoVeiculo: 'BICICLETA', placa: null });
    expect(entregadores.atualizarPerfil).toHaveBeenCalledWith(
      CPF_FICTICIO,
      expect.objectContaining({ tipo_veiculo: 'BICICLETA', placa: null }),
    );
  });

  it('recusa sair da bicicleta sem informar a placa', async () => {
    const { servico, entregadores } = montar({
      ...salvo,
      tipo_veiculo: 'BICICLETA',
      placa: null,
    });

    await expect(
      servico.editar(CPF_FICTICIO, { tipoVeiculo: TipoVeiculo.MOTO }),
    ).rejects.toThrow(new BadRequestException(MENSAGEM_PLACA_OBRIGATORIA));
    expect(entregadores.atualizarPerfil).not.toHaveBeenCalled();
  });

  it('aceita sair da bicicleta quando a placa vem junto', async () => {
    const { servico, entregadores } = montar({
      ...salvo,
      tipo_veiculo: 'BICICLETA',
      placa: null,
    });

    await servico.editar(CPF_FICTICIO, {
      tipoVeiculo: TipoVeiculo.MOTO,
      placa: 'ABC1234',
    });

    expect(entregadores.atualizarPerfil).toHaveBeenCalledWith(
      CPF_FICTICIO,
      expect.objectContaining({ tipo_veiculo: 'MOTO', placa: 'ABC1234' }),
    );
  });

  it('responde 404 quando o entregador do token nao existe mais', async () => {
    const { servico, entregadores } = montar(null);

    await expect(
      servico.editar(CPF_FICTICIO, { nome: 'Outro Nome' }),
    ).rejects.toThrow(NotFoundException);
    expect(entregadores.atualizarPerfil).not.toHaveBeenCalled();
  });
});
