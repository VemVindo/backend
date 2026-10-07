import { ConflictException, NotFoundException } from '@nestjs/common';
import { CredencialIntegracao } from '../generated/prisma/client';
import { gerarChave } from './chave-integracao';
import { CredencialRepository } from './credencial.repository';
import { CredencialService } from './credencial.service';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

const CANTINA = 1;
const PADARIA = 2;

function credencial(
  dados: Partial<CredencialIntegracao> = {},
): CredencialIntegracao {
  return {
    id_credencial: 10,
    idEmpresa: CANTINA,
    prefixo: 'aaaaaaaaaaaa',
    hash: 'hash',
    data_criacao: new Date('2026-10-06T12:00:00Z'),
    data_revogacao: null,
    ultimo_uso: null,
    ...dados,
  };
}

function montar() {
  const credenciais = {
    procurarAtiva: jest.fn().mockResolvedValue(null),
    procurarPorPrefixo: jest.fn().mockResolvedValue(null),
    criar: jest.fn((idEmpresa: number, prefixo: string, hash: string) =>
      Promise.resolve(credencial({ idEmpresa, prefixo, hash })),
    ),
    substituir: jest.fn((idEmpresa: number, prefixo: string, hash: string) =>
      Promise.resolve(credencial({ idEmpresa, prefixo, hash })),
    ),
    revogarAtiva: jest.fn().mockResolvedValue(1),
    registrarUso: jest.fn().mockResolvedValue(undefined),
  };
  const service = new CredencialService(
    credenciais as unknown as CredencialRepository,
  );
  return { service, credenciais };
}

describe('CredencialService.gerar', () => {
  it('devolve a chave uma vez e grava so o hash', async () => {
    const { service, credenciais } = montar();

    const { chave, credencial: resumo } = await service.gerar(CANTINA);

    const [, prefixoGravado, hashGravado] = credenciais.criar.mock.calls[0];
    expect(chave).toMatch(/^vv_[0-9a-f]{12}_[\w-]{43}$/);
    expect(chave).toContain(prefixoGravado);
    expect(hashGravado).not.toContain(chave.split('_')[2]);
    expect(resumo).toEqual(
      expect.objectContaining({ prefixo: `vv_${prefixoGravado}` }),
    );
    expect(resumo).not.toHaveProperty('hash');
  });

  it('recusa quando ja existe credencial ativa', async () => {
    const { service, credenciais } = montar();
    credenciais.procurarAtiva.mockResolvedValue(credencial());

    await expect(service.gerar(CANTINA)).rejects.toThrow(ConflictException);
    expect(credenciais.criar).not.toHaveBeenCalled();
  });

  it('traduz a corrida entre duas geracoes em 409', async () => {
    const { service, credenciais } = montar();
    credenciais.criar.mockRejectedValue({ code: 'P2002' });

    await expect(service.gerar(CANTINA)).rejects.toThrow(ConflictException);
  });
});

describe('CredencialService.rotacionar', () => {
  it('substitui a credencial ativa por uma nova', async () => {
    const { service, credenciais } = montar();
    credenciais.procurarAtiva.mockResolvedValue(credencial());

    const { chave } = await service.rotacionar(CANTINA);

    expect(credenciais.substituir).toHaveBeenCalledWith(
      CANTINA,
      expect.any(String),
      expect.any(String),
    );
    expect(chave).toMatch(/^vv_/);
  });

  it('recusa quando nao ha credencial para rotacionar', async () => {
    const { service, credenciais } = montar();

    await expect(service.rotacionar(CANTINA)).rejects.toThrow(
      NotFoundException,
    );
    expect(credenciais.substituir).not.toHaveBeenCalled();
  });
});

describe('CredencialService.revogar', () => {
  it('recusa quando nao ha credencial ativa', async () => {
    const { service, credenciais } = montar();
    credenciais.revogarAtiva.mockResolvedValue(0);

    await expect(service.revogar(CANTINA)).rejects.toThrow(NotFoundException);
  });
});

describe('CredencialService.autenticar', () => {
  it('identifica a empresa dona da chave e registra o uso', async () => {
    const { service, credenciais } = montar();
    const { chave, prefixo, hash } = gerarChave();
    credenciais.procurarPorPrefixo.mockResolvedValue(
      credencial({ prefixo, hash, idEmpresa: PADARIA }),
    );

    const integracao = await service.autenticar(chave);

    expect(integracao).toEqual({ empresaId: PADARIA, credencialId: 10 });
    expect(credenciais.registrarUso).toHaveBeenCalledWith(10);
  });

  it('nao consulta o banco quando o formato e invalido', async () => {
    const { service, credenciais } = montar();

    await expect(service.autenticar('qualquer-coisa')).resolves.toBeNull();
    expect(credenciais.procurarPorPrefixo).not.toHaveBeenCalled();
  });

  it('recusa prefixo desconhecido', async () => {
    const { service } = montar();

    await expect(service.autenticar(gerarChave().chave)).resolves.toBeNull();
  });

  it('recusa credencial revogada', async () => {
    const { service, credenciais } = montar();
    const { chave, prefixo, hash } = gerarChave();
    credenciais.procurarPorPrefixo.mockResolvedValue(
      credencial({ prefixo, hash, data_revogacao: new Date() }),
    );

    await expect(service.autenticar(chave)).resolves.toBeNull();
    expect(credenciais.registrarUso).not.toHaveBeenCalled();
  });

  it('recusa segredo errado com prefixo de outra empresa', async () => {
    const { service, credenciais } = montar();
    const daCantina = gerarChave();
    const tentativa = gerarChave();
    credenciais.procurarPorPrefixo.mockResolvedValue(
      credencial({ prefixo: daCantina.prefixo, hash: daCantina.hash }),
    );
    const forjada = `vv_${daCantina.prefixo}_${tentativa.chave.split('_').slice(2).join('_')}`;

    await expect(service.autenticar(forjada)).resolves.toBeNull();
  });
});
