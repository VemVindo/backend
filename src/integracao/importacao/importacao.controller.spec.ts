import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import type { UsuarioAutenticado } from '../../auth/jwt.strategy';
import { Cargo } from '../../common/enums/cargo.enum';
import {
  ImportarPedidosDto,
  LIMITE_PEDIDOS_POR_IMPORTACAO,
} from './dto/importar-pedidos.dto';
import { ImportacaoController } from './importacao.controller';
import { ImportacaoService } from './importacao.service';

jest.mock('./importacao.service', () => ({ ImportacaoService: class {} }));

const EMPRESA: UsuarioAutenticado = {
  usuarioId: '5',
  cargo: Cargo.ESTABELECIMENTO,
  empresaId: '5',
};

function montar() {
  const importacaoService = {
    importar: jest.fn().mockResolvedValue({ criados: 1 }),
    listarPendencias: jest.fn().mockResolvedValue([]),
    completar: jest.fn().mockResolvedValue({ id_pedido: 9 }),
  };
  return {
    controlador: new ImportacaoController(
      importacaoService as unknown as ImportacaoService,
    ),
    importacaoService,
  };
}

describe('ImportacaoController', () => {
  it('importa os pedidos para a empresa da chave de integracao', async () => {
    const { controlador, importacaoService } = montar();
    const pedidos = [{ id_externo: 'A1' }];

    await expect(controlador.importar(5, { pedidos })).resolves.toEqual({
      criados: 1,
    });
    expect(importacaoService.importar).toHaveBeenCalledWith(5, pedidos);
  });

  it('lista as pendencias da empresa do token', async () => {
    const { controlador, importacaoService } = montar();

    await controlador.listarPendencias(EMPRESA);

    expect(importacaoService.listarPendencias).toHaveBeenCalledWith(5);
  });

  it('completa a pendencia com os dados enviados pela empresa', async () => {
    const { controlador, importacaoService } = montar();
    const complemento = { cep: '70000000' };

    await expect(
      controlador.completar(EMPRESA, 12, complemento),
    ).resolves.toEqual({ id_pedido: 9 });
    expect(importacaoService.completar).toHaveBeenCalledWith(
      5,
      12,
      complemento,
    );
  });
});

describe('ImportarPedidosDto', () => {
  const propriedadesInvalidas = (dados: object) =>
    validateSync(plainToInstance(ImportarPedidosDto, dados)).map(
      (erro) => erro.property,
    );

  it('aceita de 1 ate o limite de pedidos por importacao', () => {
    expect(propriedadesInvalidas({ pedidos: [{}] })).toEqual([]);
    expect(
      propriedadesInvalidas({
        pedidos: Array.from(
          { length: LIMITE_PEDIDOS_POR_IMPORTACAO },
          () => ({}),
        ),
      }),
    ).toEqual([]);
  });

  it.each([
    ['lista vazia', { pedidos: [] }],
    [
      'acima do limite',
      { pedidos: Array(LIMITE_PEDIDOS_POR_IMPORTACAO + 1).fill({}) },
    ],
    ['sem lista', { pedidos: 'A1' }],
  ])('recusa %s', (_caso, dados) => {
    expect(propriedadesInvalidas(dados)).toEqual(['pedidos']);
  });
});
