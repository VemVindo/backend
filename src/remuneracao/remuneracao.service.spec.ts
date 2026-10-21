import { ConflictException } from '@nestjs/common';
import { RemuneracaoRepository } from './remuneracao.repository';
import { RemuneracaoService } from './remuneracao.service';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

const AGORA = new Date('2026-10-20T12:00:00Z');
const VIGENTES = {
  idEmpresa: 3,
  taxa_fixa: 800,
  coeficiente: 150,
  data: new Date('2026-10-01T09:00:00Z'),
};

function montar() {
  const repositorio = {
    procurarVigentes: jest.fn().mockResolvedValue(VIGENTES),
    registrar: jest
      .fn()
      .mockImplementation(
        (
          idEmpresa: number,
          p: { taxaFixa: number; coeficienteKm: number },
          data: Date,
        ) =>
          Promise.resolve({
            idEmpresa,
            taxa_fixa: p.taxaFixa,
            coeficiente: p.coeficienteKm,
            data,
          }),
      ),
  };
  const service = new RemuneracaoService(
    repositorio as unknown as RemuneracaoRepository,
  );
  return { service, repositorio };
}

describe('RemuneracaoService', () => {
  it('devolve os parametros vigentes da empresa', async () => {
    const { service, repositorio } = montar();

    await expect(service.consultar(3, AGORA)).resolves.toEqual({
      taxaFixa: 800,
      coeficienteKm: 150,
      vigenteDesde: VIGENTES.data,
    });
    expect(repositorio.procurarVigentes).toHaveBeenCalledWith(3, AGORA);
  });

  it('devolve campos vazios quando a empresa ainda nao configurou', async () => {
    const { service, repositorio } = montar();
    repositorio.procurarVigentes.mockResolvedValue(null);

    await expect(service.consultar(3, AGORA)).resolves.toEqual({
      taxaFixa: null,
      coeficienteKm: null,
      vigenteDesde: null,
    });
  });

  it('registra os novos valores valendo a partir de agora', async () => {
    const { service, repositorio } = montar();

    const salvos = await service.salvar(
      3,
      { taxaFixa: 950, coeficienteKm: 210 },
      AGORA,
    );

    expect(repositorio.registrar).toHaveBeenCalledWith(
      3,
      { taxaFixa: 950, coeficienteKm: 210 },
      AGORA,
    );
    expect(salvos).toEqual({
      taxaFixa: 950,
      coeficienteKm: 210,
      vigenteDesde: AGORA,
    });
  });

  it('responde 409 quando dois salvamentos caem no mesmo instante', async () => {
    const { service, repositorio } = montar();
    repositorio.registrar.mockRejectedValue({ code: 'P2002' });

    await expect(
      service.salvar(3, { taxaFixa: 950, coeficienteKm: 210 }, AGORA),
    ).rejects.toThrow(ConflictException);
  });

  it('repassa outros erros do banco', async () => {
    const { service, repositorio } = montar();
    const falha = new Error('conexao perdida');
    repositorio.registrar.mockRejectedValue(falha);

    await expect(
      service.salvar(3, { taxaFixa: 950, coeficienteKm: 210 }, AGORA),
    ).rejects.toBe(falha);
  });
});
