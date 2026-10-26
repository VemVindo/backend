import { Reflector } from '@nestjs/core';
import { Cargo } from '../../common/enums/cargo.enum';
import {
  contextoHttp,
  fabricaDoDecorator,
} from '../../common/test/contexto-http';
import type { UsuarioAutenticado } from '../jwt.strategy';
import { Cargos, CHAVE_CARGOS } from './cargos.decorator';
import {
  PermitirSenhaTemporaria,
  CHAVE_PERMITIR_SENHA_TEMPORARIA,
} from './permitir-senha-temporaria.decorator';
import { CHAVE_ROTA_PUBLICA, RotaPublica } from './rota-publica.decorator';
import { UsuarioAtual } from './usuario-atual.decorator';

const reflector = new Reflector();

describe('decorators de autenticacao', () => {
  it('marca a rota com os cargos permitidos', () => {
    class RotaComCargos {
      @Cargos(Cargo.ESTABELECIMENTO, Cargo.ENTREGADOR)
      rota(this: void) {}
    }

    expect(reflector.get(CHAVE_CARGOS, RotaComCargos.prototype.rota)).toEqual([
      Cargo.ESTABELECIMENTO,
      Cargo.ENTREGADOR,
    ]);
  });

  it('marca a rota como liberada para senha temporaria', () => {
    class RotaLiberada {
      @PermitirSenhaTemporaria()
      rota(this: void) {}
    }

    expect(
      reflector.get(
        CHAVE_PERMITIR_SENHA_TEMPORARIA,
        RotaLiberada.prototype.rota,
      ),
    ).toBe(true);
  });

  it('marca a rota como publica', () => {
    class RotaAberta {
      @RotaPublica()
      rota(this: void) {}
    }

    expect(reflector.get(CHAVE_ROTA_PUBLICA, RotaAberta.prototype.rota)).toBe(
      true,
    );
  });

  it('entrega o usuario que o guard colocou na requisicao', () => {
    const usuario: UsuarioAutenticado = {
      usuarioId: '7',
      cargo: Cargo.ESTABELECIMENTO,
      empresaId: '7',
    };
    const extrairUsuario = fabricaDoDecorator(UsuarioAtual);

    expect(extrairUsuario(undefined, contextoHttp({ user: usuario }))).toBe(
      usuario,
    );
  });
});
