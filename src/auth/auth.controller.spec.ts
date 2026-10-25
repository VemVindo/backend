import type { Response } from 'express';
import { Cargo } from '../common/enums/cargo.enum';
import { COOKIE_DE_AUTENTICACAO } from './auth-cookie';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CadastrarEmpresaDto } from './dto/cadastrar-empresa.dto';
import type { UsuarioAutenticado } from './jwt.strategy';

jest.mock('./auth.service', () => ({ AuthService: class {} }));

const EXPIRA_EM = new Date('2026-10-26T12:00:00Z');
const ENTREGADOR: UsuarioAutenticado = {
  usuarioId: '52998224725',
  cargo: Cargo.ENTREGADOR,
};

function respostaComToken(usuario: object) {
  return { tokenAcesso: 'token-assinado', expiraEm: EXPIRA_EM, usuario };
}

function montar() {
  const authService = {
    cadastrarEmpresa: jest.fn().mockResolvedValue(respostaComToken({ id: 1 })),
    loginEmpresa: jest.fn().mockResolvedValue(respostaComToken({ id: 2 })),
    loginEntregador: jest.fn().mockResolvedValue(respostaComToken({ id: 3 })),
    sairDeTodosOsAparelhos: jest.fn().mockResolvedValue(undefined),
    minhasInformacoes: jest.fn().mockResolvedValue({ nome: 'Fulano' }),
    trocarSenhaEntregador: jest
      .fn()
      .mockResolvedValue(respostaComToken({ id: 4 })),
  };
  const resposta = { cookie: jest.fn(), clearCookie: jest.fn() };
  return {
    controlador: new AuthController(authService as unknown as AuthService),
    authService,
    resposta,
    respostaHttp: resposta as unknown as Response,
  };
}

describe('AuthController', () => {
  it('cadastra a empresa, grava o token no cookie e nao devolve o token', async () => {
    const { controlador, authService, resposta, respostaHttp } = montar();
    const dto = { email: 'loja@exemplo.com' } as CadastrarEmpresaDto;

    await expect(
      controlador.cadastrarEmpresa(dto, respostaHttp),
    ).resolves.toEqual({ usuario: { id: 1 } });
    expect(authService.cadastrarEmpresa).toHaveBeenCalledWith(dto);
    expect(resposta.cookie).toHaveBeenCalledWith(
      COOKIE_DE_AUTENTICACAO,
      'token-assinado',
      expect.objectContaining({ httpOnly: true, expires: EXPIRA_EM }),
    );
  });

  it('autentica empresa e entregador pelo cookie', async () => {
    const { controlador, authService, resposta, respostaHttp } = montar();
    const credenciaisEmpresa = { email: 'loja@exemplo.com', senha: 'x' };
    const credenciaisEntregador = { cpf: '52998224725', senha: 'y' };

    await expect(
      controlador.loginEmpresa(credenciaisEmpresa, respostaHttp),
    ).resolves.toEqual({ usuario: { id: 2 } });
    await expect(
      controlador.loginEntregador(credenciaisEntregador, respostaHttp),
    ).resolves.toEqual({ usuario: { id: 3 } });

    expect(authService.loginEmpresa).toHaveBeenCalledWith(credenciaisEmpresa);
    expect(authService.loginEntregador).toHaveBeenCalledWith(
      credenciaisEntregador,
    );
    expect(resposta.cookie).toHaveBeenCalledTimes(2);
  });

  it('sair apaga o cookie deste aparelho', () => {
    const { controlador, resposta, respostaHttp } = montar();

    controlador.sair(respostaHttp);

    expect(resposta.clearCookie).toHaveBeenCalledWith(
      COOKIE_DE_AUTENTICACAO,
      expect.objectContaining({ path: '/' }),
    );
  });

  it('sair de todos invalida as sessoes antes de apagar o cookie', async () => {
    const { controlador, authService, resposta, respostaHttp } = montar();

    await controlador.sairDeTodosOsAparelhos(ENTREGADOR, respostaHttp);

    expect(authService.sairDeTodosOsAparelhos).toHaveBeenCalledWith(ENTREGADOR);
    expect(resposta.clearCookie).toHaveBeenCalledTimes(1);
  });

  it('devolve as informacoes do usuario logado', async () => {
    const { controlador, authService } = montar();

    await expect(controlador.minhasInformacoes(ENTREGADOR)).resolves.toEqual({
      nome: 'Fulano',
    });
    expect(authService.minhasInformacoes).toHaveBeenCalledWith(ENTREGADOR);
  });

  it('troca a senha do entregador e renova o cookie', async () => {
    const { controlador, authService, resposta, respostaHttp } = montar();
    const dto = { senhaAtual: 'Antiga@123', novaSenha: 'Nova@12345' };

    await expect(
      controlador.trocarSenha(ENTREGADOR, dto, respostaHttp),
    ).resolves.toEqual({ usuario: { id: 4 } });
    expect(authService.trocarSenhaEntregador).toHaveBeenCalledWith(
      ENTREGADOR,
      dto,
    );
    expect(resposta.cookie).toHaveBeenCalledTimes(1);
  });
});
