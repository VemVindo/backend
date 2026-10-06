import { ConflictException, NotFoundException } from '@nestjs/common';
import { TipoVeiculo } from '../common/enums/tipo-veiculo.enum';
import { PasswordService } from '../common/security/senha.service';
import { ContratoRepository } from '../contrato/contrato.repository';
import { CadastrarEntregadorDto } from './dto/cadastrar-entregador.dto';
import { EntregadorRepository } from './entregador.repository';
import { EntregadorService } from './entregador.service';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

const CPF_FICTICIO = '52998224725';
const ID_EMPRESA = 1;

function montar() {
  const entregadores = {
    findByCpf: jest.fn().mockResolvedValue(null),
    createComVinculo: jest.fn(
      (data: { cpf: string; nome: string; placa: string | null }) =>
        Promise.resolve({
          cpf: data.cpf,
          nome: data.nome,
          tipo_veiculo: 'MOTO',
          placa: data.placa,
        }),
    ),
  };
  const contratos = {
    findVinculoAtivo: jest.fn().mockResolvedValue(null),
    criarVinculo: jest.fn().mockResolvedValue({}),
  };
  const password = { hash: jest.fn().mockResolvedValue('hash') };
  const service = new EntregadorService(
    entregadores as unknown as EntregadorRepository,
    contratos as unknown as ContratoRepository,
    password as unknown as PasswordService,
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
  it('cria o entregador ja vinculado e devolve a senha temporaria', async () => {
    const { service, entregadores } = montar();

    const resultado = await service.cadastrar(ID_EMPRESA, dto);

    expect(entregadores.createComVinculo).toHaveBeenCalledWith(
      expect.objectContaining({ cpf: CPF_FICTICIO, senhaHash: 'hash' }),
      ID_EMPRESA,
    );
    expect(resultado.senhaTemporaria).toMatch(/^[\w-]{12}$/);
  });

  it('descarta placa enviada para bicicleta', async () => {
    const { service, entregadores } = montar();

    await service.cadastrar(ID_EMPRESA, {
      ...dto,
      tipoVeiculo: TipoVeiculo.BICICLETA,
    });

    expect(entregadores.createComVinculo).toHaveBeenCalledWith(
      expect.objectContaining({ placa: null }),
      ID_EMPRESA,
    );
  });

  it('recusa CPF ja cadastrado', async () => {
    const { service, entregadores } = montar();
    entregadores.findByCpf.mockResolvedValue({ cpf: CPF_FICTICIO });

    await expect(service.cadastrar(ID_EMPRESA, dto)).rejects.toThrow(
      ConflictException,
    );
    expect(entregadores.createComVinculo).not.toHaveBeenCalled();
  });

  it('converte corrida no unique do banco em 409', async () => {
    const { service, entregadores } = montar();
    entregadores.createComVinculo.mockRejectedValue({ code: 'P2002' });

    await expect(service.cadastrar(ID_EMPRESA, dto)).rejects.toThrow(
      ConflictException,
    );
  });
});

describe('EntregadorService.vincular', () => {
  it('recusa CPF inexistente', async () => {
    const { service } = montar();
    await expect(service.vincular(ID_EMPRESA, CPF_FICTICIO)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('recusa vinculo ja ativo', async () => {
    const { service, entregadores, contratos } = montar();
    entregadores.findByCpf.mockResolvedValue({ cpf: CPF_FICTICIO });
    contratos.findVinculoAtivo.mockResolvedValue({ id_contrato: 1 });

    await expect(service.vincular(ID_EMPRESA, CPF_FICTICIO)).rejects.toThrow(
      ConflictException,
    );
    expect(contratos.criarVinculo).not.toHaveBeenCalled();
  });

  it('converte vinculo simultaneo barrado pelo banco em 409', async () => {
    const { service, entregadores, contratos } = montar();
    entregadores.findByCpf.mockResolvedValue({ cpf: CPF_FICTICIO });
    contratos.criarVinculo.mockRejectedValue({ code: 'P2002' });

    await expect(service.vincular(ID_EMPRESA, CPF_FICTICIO)).rejects.toThrow(
      ConflictException,
    );
  });

  it('vincula entregador existente', async () => {
    const { service, entregadores, contratos } = montar();
    entregadores.findByCpf.mockResolvedValue({
      cpf: CPF_FICTICIO,
      nome: 'Entregador Teste',
      tipo_veiculo: 'MOTO',
      placa: 'ABC1D23',
    });

    const resultado = await service.vincular(ID_EMPRESA, CPF_FICTICIO);

    expect(contratos.criarVinculo).toHaveBeenCalledWith(
      ID_EMPRESA,
      CPF_FICTICIO,
    );
    expect(resultado.vinculado).toBe(true);
  });
});
