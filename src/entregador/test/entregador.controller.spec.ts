import { ServicoDesempenhoEntregador } from '../desempenho-entregador.service';
import { EntregadorController } from '../entregador.controller';
import { EntregadorService } from '../entregador.service';
import { RemocaoDaFrotaService } from '../remocao-da-frota.service';
import type { UsuarioAutenticado } from '../../auth/jwt.strategy';
import { Cargo } from '../../common/enums/cargo.enum';
import { CadastrarEntregadorDto } from '../dto/cadastrar-entregador.dto';

describe('EntregadorController rotas da frota', () => {
  const CPF_ENTREGADOR = '52998224725';
  const usuario: UsuarioAutenticado = {
    usuarioId: '7',
    empresaId: '7',
    cargo: Cargo.ESTABELECIMENTO,
  };

  function montar() {
    const entregadorService = {
      cadastrar: jest.fn().mockResolvedValue('cadastrado'),
      convidar: jest.fn().mockResolvedValue('convidado'),
      listarFrota: jest.fn().mockResolvedValue('frota'),
      gerarNovaSenhaTemporaria: jest.fn().mockResolvedValue('senha'),
    };
    const servicoDesempenho = {
      consultarDesempenho: jest.fn().mockResolvedValue('desempenho'),
    };
    const remocaoDaFrota = {
      desvincular: jest.fn().mockResolvedValue('removido'),
    };
    const controlador = new EntregadorController(
      entregadorService as unknown as EntregadorService,
      servicoDesempenho as unknown as ServicoDesempenhoEntregador,
      remocaoDaFrota as unknown as RemocaoDaFrotaService,
    );
    return {
      controlador,
      entregadorService,
      servicoDesempenho,
      remocaoDaFrota,
    };
  }

  it('consulta o desempenho do entregador na empresa do token', async () => {
    const { controlador, servicoDesempenho } = montar();
    const filtro = {
      de: '2026-10-01T00:00:00-03:00',
      ate: '2026-10-31T23:59:59-03:00',
    };

    await expect(
      controlador.consultarDesempenho(usuario, { cpf: CPF_ENTREGADOR }, filtro),
    ).resolves.toBe('desempenho');
    expect(servicoDesempenho.consultarDesempenho).toHaveBeenCalledWith(
      7,
      CPF_ENTREGADOR,
      filtro,
    );
  });

  it('cadastra e convida usando a empresa do token', async () => {
    const { controlador, entregadorService } = montar();
    const cadastro = { cpf: CPF_ENTREGADOR } as CadastrarEntregadorDto;

    await expect(controlador.cadastrar(usuario, cadastro)).resolves.toBe(
      'cadastrado',
    );
    await expect(
      controlador.convidar(usuario, { cpf: CPF_ENTREGADOR }),
    ).resolves.toBe('convidado');
    expect(entregadorService.cadastrar).toHaveBeenCalledWith(7, cadastro);
    expect(entregadorService.convidar).toHaveBeenCalledWith(7, CPF_ENTREGADOR);
  });

  it('lista a frota e gera nova senha temporaria na empresa do token', async () => {
    const { controlador, entregadorService } = montar();

    await expect(controlador.listarFrota(usuario)).resolves.toBe('frota');
    await expect(
      controlador.gerarNovaSenhaTemporaria(usuario, { cpf: CPF_ENTREGADOR }),
    ).resolves.toBe('senha');
    expect(entregadorService.listarFrota).toHaveBeenCalledWith(7);
    expect(entregadorService.gerarNovaSenhaTemporaria).toHaveBeenCalledWith(
      7,
      CPF_ENTREGADOR,
    );
  });

  it('desvincula o entregador da frota da empresa do token', async () => {
    const { controlador, remocaoDaFrota } = montar();

    await expect(
      controlador.desvincular(usuario, { cpf: CPF_ENTREGADOR }),
    ).resolves.toBe('removido');
    expect(remocaoDaFrota.desvincular).toHaveBeenCalledWith(7, CPF_ENTREGADOR);
  });
});
