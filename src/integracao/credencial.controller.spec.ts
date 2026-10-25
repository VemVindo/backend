import { Reflector } from '@nestjs/core';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { CHAVE_ROTA_PUBLICA } from '../auth/decorators/rota-publica.decorator';
import type { UsuarioAutenticado } from '../auth/jwt.strategy';
import { Cargo } from '../common/enums/cargo.enum';
import { contextoHttp, fabricaDoDecorator } from '../common/test/contexto-http';
import { CredencialIntegracaoGuard } from './credencial-integracao.guard';
import { CredencialController } from './credencial.controller';
import { CredencialService } from './credencial.service';
import { AutenticarIntegracao } from './decorators/autenticar-integracao.decorator';
import { EmpresaDaIntegracao } from './decorators/empresa-da-integracao.decorator';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

const EMPRESA: UsuarioAutenticado = {
  usuarioId: '8',
  cargo: Cargo.ESTABELECIMENTO,
  empresaId: '8',
};

function montar() {
  const credencialService = {
    consultar: jest.fn().mockResolvedValue({ ativa: true }),
    gerar: jest.fn().mockResolvedValue({ chave: 'nova' }),
    rotacionar: jest.fn().mockResolvedValue({ chave: 'rotacionada' }),
    revogar: jest.fn().mockResolvedValue(undefined),
  };
  return {
    controlador: new CredencialController(
      credencialService as unknown as CredencialService,
    ),
    credencialService,
  };
}

describe('CredencialController', () => {
  it.each([
    ['consultar', { ativa: true }],
    ['gerar', { chave: 'nova' }],
    ['rotacionar', { chave: 'rotacionada' }],
    ['revogar', undefined],
  ] as const)(
    '%s usa a empresa do token convertida para numero',
    async (acao, esperado) => {
      const { controlador, credencialService } = montar();

      await expect(controlador[acao](EMPRESA)).resolves.toEqual(esperado);
      expect(credencialService[acao]).toHaveBeenCalledWith(8);
    },
  );

  it('confirma a chave de integracao devolvendo a empresa dona dela', () => {
    const { controlador } = montar();

    expect(controlador.verificar(8)).toEqual({ valida: true, empresaId: 8 });
  });
});

describe('decorators da integracao', () => {
  it('AutenticarIntegracao libera o JWT e exige a chave de integracao', () => {
    class RotaDeIntegracao {
      @AutenticarIntegracao()
      rota(this: void) {}
    }
    const rota = RotaDeIntegracao.prototype.rota;

    expect(new Reflector().get(CHAVE_ROTA_PUBLICA, rota)).toBe(true);
    expect(Reflect.getMetadata(GUARDS_METADATA, rota)).toEqual([
      CredencialIntegracaoGuard,
    ]);
  });

  it('EmpresaDaIntegracao le a empresa autenticada pela chave', () => {
    const extrairEmpresa = fabricaDoDecorator(EmpresaDaIntegracao);
    const requisicao = { integracao: { empresaId: 8, credencialId: 1 } };

    expect(extrairEmpresa(undefined, contextoHttp(requisicao))).toBe(8);
  });
});
