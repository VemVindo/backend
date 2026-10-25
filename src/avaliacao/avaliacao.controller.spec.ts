import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import type { UsuarioAutenticado } from '../auth/jwt.strategy';
import { Cargo } from '../common/enums/cargo.enum';
import type { RequisicaoRecebedor } from '../rastreio/acesso-recebedor.guard';
import type { AcessoComPedido } from '../rastreio/rastreio.repository';
import { ValidadorDeLink } from '../rastreio/validador-de-link';
import { AcessoParaAvaliarGuard } from './acesso-para-avaliar.guard';
import {
  AvaliacaoDaEmpresaController,
  AvaliacaoDoRecebedorController,
} from './avaliacao.controller';
import { AvaliacaoService } from './avaliacao.service';
import { AvaliarDto, ComentarDto } from './dto/avaliar.dto';
import { FiltroAvaliacoesDto } from './dto/filtro-avaliacoes.dto';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

const ACESSO = { idPedido: 42 } as AcessoComPedido;

function servico() {
  return {
    consultar: jest.fn().mockResolvedValue({}),
    avaliar: jest.fn().mockResolvedValue({}),
    comentar: jest.fn().mockResolvedValue({}),
    listarDaEmpresa: jest.fn().mockResolvedValue([]),
  };
}

describe('AvaliacaoDoRecebedorController', () => {
  it('usa o pedido do link, nunca um id do corpo', async () => {
    const avaliacoes = servico();
    const controlador = new AvaliacaoDoRecebedorController(
      avaliacoes as unknown as AvaliacaoService,
    );

    await controlador.consultar(ACESSO);
    await controlador.avaliar(ACESSO, { nota: 5 });
    await controlador.comentar(ACESSO, { comentario: 'Otimo' });

    expect(avaliacoes.consultar).toHaveBeenCalledWith(ACESSO);
    expect(avaliacoes.avaliar).toHaveBeenCalledWith(ACESSO, 5);
    expect(avaliacoes.comentar).toHaveBeenCalledWith(ACESSO, 'Otimo');
  });
});

describe('AvaliacaoDaEmpresaController', () => {
  it('lista com a empresa do token', async () => {
    const avaliacoes = servico();
    const controlador = new AvaliacaoDaEmpresaController(
      avaliacoes as unknown as AvaliacaoService,
    );
    const usuario: UsuarioAutenticado = {
      usuarioId: '3',
      cargo: Cargo.ESTABELECIMENTO,
      empresaId: '3',
    };

    await controlador.listar(usuario, { notas: [1] });

    expect(avaliacoes.listarDaEmpresa).toHaveBeenCalledWith(3, { notas: [1] });
  });
});

describe('AcessoParaAvaliarGuard', () => {
  function contexto(token: unknown) {
    const requisicao = { params: { token } } as unknown as RequisicaoRecebedor;
    const ctx = {
      switchToHttp: () => ({ getRequest: () => requisicao }),
    } as unknown as ExecutionContext;
    return { ctx, requisicao };
  }

  it('aceita o link mesmo com a entrega encerrada', async () => {
    const procurarAcesso = jest.fn().mockResolvedValue(ACESSO);
    const guard = new AcessoParaAvaliarGuard({
      procurarAcesso,
    } as unknown as ValidadorDeLink);
    const { ctx, requisicao } = contexto('token');

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(requisicao.acessoRecebedor).toBe(ACESSO);
  });

  it('responde 404 para link invalido', async () => {
    const procurarAcesso = jest.fn().mockResolvedValue(null);
    const guard = new AcessoParaAvaliarGuard({
      procurarAcesso,
    } as unknown as ValidadorDeLink);

    await expect(guard.canActivate(contexto(undefined).ctx)).rejects.toThrow(
      NotFoundException,
    );
    expect(procurarAcesso).toHaveBeenCalledWith('');
  });
});

describe('DTOs da avaliacao', () => {
  const erros = (classe: new () => object, dados: object) =>
    validateSync(plainToInstance(classe, dados)).map((e) => e.property);

  it.each([0, 5])('aceita a nota %s', (nota) => {
    expect(erros(AvaliarDto, { nota })).toEqual([]);
  });

  it.each([-1, 6, 4.5, '5'])('recusa a nota %s', (nota) => {
    expect(erros(AvaliarDto, { nota })).toEqual(['nota']);
  });

  it('exige comentario com texto e limita o tamanho', () => {
    expect(erros(ComentarDto, { comentario: '   ' })).toEqual(['comentario']);
    expect(erros(ComentarDto, { comentario: 'x'.repeat(501) })).toEqual([
      'comentario',
    ]);
    expect(erros(ComentarDto, { comentario: ' Bom ' })).toEqual([]);
  });

  it('converte o filtro da query string', () => {
    const filtro = plainToInstance(FiltroAvaliacoesDto, {
      notas: '1,2',
      de: '2026-10-01T00:00:00Z',
    });

    expect(validateSync(filtro)).toEqual([]);
    expect(filtro.notas).toEqual([1, 2]);
    expect(filtro.de).toEqual(new Date('2026-10-01T00:00:00Z'));
  });

  it('converte a data final e mantem valores que ja chegam tipados', () => {
    const ate = new Date('2026-10-31T23:59:59Z');
    const filtro = plainToInstance(FiltroAvaliacoesDto, {
      notas: [0, 5],
      de: ate,
      ate: '2026-10-31T23:59:59Z',
    });

    expect(validateSync(filtro)).toEqual([]);
    expect(filtro.notas).toEqual([0, 5]);
    expect(filtro.de).toEqual(ate);
    expect(filtro.ate).toEqual(ate);
  });

  it('recusa data final que nao e data', () => {
    expect(erros(FiltroAvaliacoesDto, { ate: 123 })).toEqual(['ate']);
  });

  it('recusa nota e data invalidas no filtro', () => {
    expect(
      erros(FiltroAvaliacoesDto, { notas: '1,9', de: 'ontem' }).sort(),
    ).toEqual(['de', 'notas']);
  });
});
