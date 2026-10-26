import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { CHAVE_ROTA_PUBLICA } from '../auth/decorators/rota-publica.decorator';
import type { UsuarioAutenticado } from '../auth/jwt.strategy';
import { Cargo } from '../common/enums/cargo.enum';
import { contextoHttp, fabricaDoDecorator } from '../common/test/contexto-http';
import { AcessoRecebedorGuard } from './acesso-recebedor.guard';
import { AcessoDoRecebedor } from './decorators/acesso-do-recebedor.decorator';
import { AutenticarRecebedor } from './decorators/autenticar-recebedor.decorator';
import { RastreioController } from './rastreio.controller';
import type { AcessoComPedido } from './rastreio.repository';
import { RastreioService } from './rastreio.service';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

const ACESSO = { idPedido: 42 } as AcessoComPedido;

function montar() {
  const rastreioService = {
    montarPaginaDoRecebedor: jest.fn().mockReturnValue({ status: 'PENDENTE' }),
    gerarNovoLink: jest.fn().mockResolvedValue({ link: '/rastreio/novo' }),
  };
  return {
    controlador: new RastreioController(
      rastreioService as unknown as RastreioService,
    ),
    rastreioService,
  };
}

describe('RastreioController', () => {
  it('monta a pagina do recebedor a partir do acesso validado pelo guard', () => {
    const { controlador, rastreioService } = montar();

    expect(controlador.consultar(ACESSO)).toEqual({ status: 'PENDENTE' });
    expect(rastreioService.montarPaginaDoRecebedor).toHaveBeenCalledWith(
      ACESSO,
    );
  });

  it('gera link novo so para pedido da empresa do token', async () => {
    const { controlador, rastreioService } = montar();
    const empresa: UsuarioAutenticado = {
      usuarioId: '3',
      cargo: Cargo.ESTABELECIMENTO,
      empresaId: '3',
    };

    await expect(controlador.gerarNovoLink(empresa, 42)).resolves.toEqual({
      link: '/rastreio/novo',
    });
    expect(rastreioService.gerarNovoLink).toHaveBeenCalledWith(3, 42);
  });
});

describe('decorators do recebedor', () => {
  it('AutenticarRecebedor libera o JWT e exige o link de rastreio', () => {
    class RotaDoRecebedor {
      @AutenticarRecebedor()
      rota(this: void) {}
    }
    const rota = RotaDoRecebedor.prototype.rota;

    expect(new Reflector().get(CHAVE_ROTA_PUBLICA, rota)).toBe(true);
    expect(Reflect.getMetadata(GUARDS_METADATA, rota)).toEqual([
      AcessoRecebedorGuard,
    ]);
  });

  it('AcessoDoRecebedor le o acesso que o guard anexou', () => {
    const extrairAcesso = fabricaDoDecorator(AcessoDoRecebedor);

    expect(
      extrairAcesso(undefined, contextoHttp({ acessoRecebedor: ACESSO })),
    ).toBe(ACESSO);
  });
});
