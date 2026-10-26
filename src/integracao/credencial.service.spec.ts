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
  const servico = new CredencialService(
    credenciais as unknown as CredencialRepository,
  );
  return { servico, credenciais };
}

describe('CredencialService.gerar', () => {
  it('devolve a chave uma vez e grava so o hash', async () => {
    const { servico, credenciais } = montar();

    const { chave, credencial: resumo } = await servico.gerar(CANTINA);

    const [, prefixoGravado, hashGravado] = credenciais.criar.mock.calls[0];
    expect(chave).toMatch(/^vv_[0-9a-f]{12}_[\w-]{43}$/);
    const segredo = chave.slice(`vv_${prefixoGravado}_`.length);
    expect(chave).toBe(`vv_${prefixoGravado}_${segredo}`);
    expect(segredo).toHaveLength(43);
    expect(hashGravado).not.toContain(segredo);
    expect(resumo).toEqual(
      expect.objectContaining({ prefixo: `vv_${prefixoGravado}` }),
    );
    expect(resumo).not.toHaveProperty('hash');
  });

  it('recusa quando ja existe credencial ativa', async () => {
    const { servico, credenciais } = montar();
    credenciais.procurarAtiva.mockResolvedValue(credencial());

    await expect(servico.gerar(CANTINA)).rejects.toThrow(ConflictException);
    expect(credenciais.criar).not.toHaveBeenCalled();
  });

  it('traduz a corrida entre duas geracoes em 409', async () => {
    const { servico, credenciais } = montar();
    credenciais.criar.mockRejectedValue({ code: 'P2002' });

    await expect(servico.gerar(CANTINA)).rejects.toThrow(ConflictException);
  });
});

describe('CredencialService.rotacionar', () => {
  it('substitui a credencial ativa por uma nova', async () => {
    const { servico, credenciais } = montar();
    credenciais.procurarAtiva.mockResolvedValue(credencial());

    const { chave } = await servico.rotacionar(CANTINA);

    expect(credenciais.substituir).toHaveBeenCalledWith(
      CANTINA,
      expect.any(String),
      expect.any(String),
    );
    expect(chave).toMatch(/^vv_/);
  });

  it('recusa quando nao ha credencial para rotacionar', async () => {
    const { servico, credenciais } = montar();

    await expect(servico.rotacionar(CANTINA)).rejects.toThrow(
      NotFoundException,
    );
    expect(credenciais.substituir).not.toHaveBeenCalled();
  });
});

describe('CredencialService.consultar', () => {
  it('mostra so o resumo da credencial ativa, sem o hash', async () => {
    const { servico, credenciais } = montar();
    credenciais.procurarAtiva.mockResolvedValue(credencial());

    const { credencial: resumo } = await servico.consultar(CANTINA);

    expect(resumo).toEqual(
      expect.objectContaining({ prefixo: 'vv_aaaaaaaaaaaa' }),
    );
    expect(resumo).not.toHaveProperty('hash');
  });

  it('devolve nulo quando a empresa nao tem credencial ativa', async () => {
    const { servico } = montar();

    await expect(servico.consultar(CANTINA)).resolves.toEqual({
      credencial: null,
    });
  });
});

describe('CredencialService erros do banco', () => {
  it('ao gerar, converte corrida no unique em 409', async () => {
    const { servico, credenciais } = montar();
    credenciais.criar.mockRejectedValue({ code: 'P2002' });

    await expect(servico.gerar(CANTINA)).rejects.toThrow(ConflictException);
  });

  it('ao rotacionar, converte corrida no unique em 409', async () => {
    const { servico, credenciais } = montar();
    credenciais.procurarAtiva.mockResolvedValue(credencial());
    credenciais.substituir.mockRejectedValue({ code: 'P2002' });

    await expect(servico.rotacionar(CANTINA)).rejects.toThrow(
      ConflictException,
    );
  });

  it.each([
    ['gerar', 'criar'],
    ['rotacionar', 'substituir'],
  ] as const)(
    'ao %s, propaga erro que nao e de unicidade',
    async (acao, metodo) => {
      const { servico, credenciais } = montar();
      const falha = new Error('banco fora do ar');
      credenciais.procurarAtiva.mockResolvedValue(
        acao === 'rotacionar' ? credencial() : null,
      );
      credenciais[metodo].mockRejectedValue(falha);

      await expect(servico[acao](CANTINA)).rejects.toBe(falha);
    },
  );
});

describe('CredencialService.revogar', () => {
  it('revoga a credencial ativa', async () => {
    const { servico, credenciais } = montar();

    await expect(servico.revogar(CANTINA)).resolves.toBeUndefined();
    expect(credenciais.revogarAtiva).toHaveBeenCalledWith(CANTINA);
  });

  it('recusa quando nao ha credencial ativa', async () => {
    const { servico, credenciais } = montar();
    credenciais.revogarAtiva.mockResolvedValue(0);

    await expect(servico.revogar(CANTINA)).rejects.toThrow(NotFoundException);
  });
});

describe('CredencialService.autenticar', () => {
  it('identifica a empresa dona da chave e registra o uso', async () => {
    const { servico, credenciais } = montar();
    const { chave, prefixo, hash } = gerarChave();
    credenciais.procurarPorPrefixo.mockResolvedValue(
      credencial({ prefixo, hash, idEmpresa: PADARIA }),
    );

    const integracao = await servico.autenticar(chave);

    expect(integracao).toEqual({ empresaId: PADARIA, credencialId: 10 });
    expect(credenciais.registrarUso).toHaveBeenCalledWith(10);
  });

  it('nao consulta o banco quando o formato e invalido', async () => {
    const { servico, credenciais } = montar();

    await expect(servico.autenticar('qualquer-coisa')).resolves.toBeNull();
    expect(credenciais.procurarPorPrefixo).not.toHaveBeenCalled();
  });

  it('recusa prefixo desconhecido', async () => {
    const { servico } = montar();

    await expect(servico.autenticar(gerarChave().chave)).resolves.toBeNull();
  });

  it('recusa credencial revogada', async () => {
    const { servico, credenciais } = montar();
    const { chave, prefixo, hash } = gerarChave();
    credenciais.procurarPorPrefixo.mockResolvedValue(
      credencial({ prefixo, hash, data_revogacao: new Date() }),
    );

    await expect(servico.autenticar(chave)).resolves.toBeNull();
    expect(credenciais.registrarUso).not.toHaveBeenCalled();
  });

  it('recusa segredo errado com prefixo de outra empresa', async () => {
    const { servico, credenciais } = montar();
    const daCantina = gerarChave();
    const tentativa = gerarChave();
    credenciais.procurarPorPrefixo.mockResolvedValue(
      credencial({ prefixo: daCantina.prefixo, hash: daCantina.hash }),
    );
    const forjada = `vv_${daCantina.prefixo}_${tentativa.chave.split('_').slice(2).join('_')}`;

    await expect(servico.autenticar(forjada)).resolves.toBeNull();
  });
});
