import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../src/auth/auth.service';
import { JwtPayload, JwtStrategy } from '../src/auth/jwt.strategy';
import { TipoVeiculo } from '../src/common/enums/tipo-veiculo.enum';
import { SenhaService } from '../src/common/security/senha.service';
import { ContratoRepository } from '../src/contrato/contrato.repository';
import { EmpresaRepository } from '../src/empresa/empresa.repository';
import { EntregadorRepository } from '../src/entregador/entregador.repository';
import { EntregadorService } from '../src/entregador/entregador.service';
import type { RemocaoDaFrotaRepository } from '../src/entregador/remocao-da-frota.repository';
import { StatusContrato } from '../src/generated/prisma/enums';
import type { LocalizacaoService } from '../src/mapa/localizacao.service';
import {
  BancoIsolado,
  TEMPO_LIMITE_PREPARACAO_MS,
  cadastrarEmpresa,
  criarBancoIsolado,
  descreverComBanco,
} from './apoio/banco-isolado';
import { gerarCpfValido } from './apoio/cpf';

const SEGREDO_DO_JWT =
  'segredo-do-teste-de-integracao-com-mais-de-32-caracteres';
const NOVA_SENHA = 'MinhaSenha@2026';
const HORA_MS = 60 * 60 * 1000;

descreverComBanco(
  'E-US04 e EN-US01 senha temporaria e sessao no PostgreSQL',
  () => {
    let banco: BancoIsolado;
    let entregadores: EntregadorService;
    let auth: AuthService;
    let estrategia: JwtStrategy;
    let jwt: JwtService;
    let idEmpresa: number;
    async function cadastrar() {
      const cpf = gerarCpfValido();
      const { senhaTemporaria } = await entregadores.cadastrar(idEmpresa, {
        nome: 'Entregador de Teste',
        cpf,
        telefone: '61988887777',
        tipoVeiculo: TipoVeiculo.MOTO,
        placa: 'ABC1D23',
      });
      return { cpf, senhaTemporaria };
    }

    function validar(tokenAcesso: string) {
      return estrategia.validate(jwt.decode<JwtPayload>(tokenAcesso));
    }

    function gravado(cpf: string) {
      return banco.prisma.entregador.findUniqueOrThrow({ where: { cpf } });
    }

    beforeAll(async () => {
      banco = await criarBancoIsolado('senha');
      const repositorioDeEntregadores = new EntregadorRepository(banco.prisma);
      const repositorioDeEmpresas = new EmpresaRepository(banco.prisma);
      const senha = new SenhaService();
      jwt = new JwtService({
        secret: SEGREDO_DO_JWT,
        signOptions: { expiresIn: '1h' },
      });
      entregadores = new EntregadorService(
        repositorioDeEntregadores,
        new ContratoRepository(banco.prisma),
        senha,
        {} as RemocaoDaFrotaRepository,
        {} as LocalizacaoService,
      );
      auth = new AuthService(
        repositorioDeEmpresas,
        repositorioDeEntregadores,
        jwt,
        senha,
      );
      estrategia = new JwtStrategy(
        new ConfigService({ JWT_SECRET: SEGREDO_DO_JWT }),
        repositorioDeEmpresas,
        repositorioDeEntregadores,
      );
      idEmpresa = await cadastrarEmpresa(banco.prisma, 'senha');
    }, TEMPO_LIMITE_PREPARACAO_MS);

    afterAll(async () => {
      await banco?.encerrar();
    });

    it('o cadastro grava o hash da senha temporaria, o prazo e o convite pendente', async () => {
      const antes = Date.now();
      const { cpf, senhaTemporaria } = await cadastrar();

      const entregador = await gravado(cpf);
      expect(entregador.senha).not.toBe(senhaTemporaria);
      expect(entregador.senha).toMatch(/^\$2[aby]\$12\$/);
      expect(entregador.senha_temporaria).toBe(true);
      expect(
        entregador.senha_temporaria_expira_em?.getTime(),
      ).toBeGreaterThanOrEqual(antes + 47 * HORA_MS);
      const contratos = await banco.prisma.contrato.findMany({
        where: { cpf_entregador: cpf },
      });
      expect(contratos).toEqual([
        expect.objectContaining({ idEmpresa, status: StatusContrato.PENDENTE }),
      ]);
    });

    it('a troca de senha encerra as sessoes abertas antes dela', async () => {
      const { cpf, senhaTemporaria } = await cadastrar();
      const login = await auth.loginEntregador({ cpf, senha: senhaTemporaria });
      await expect(validar(login.tokenAcesso)).resolves.toMatchObject({
        usuarioId: cpf,
        senhaTemporaria: true,
      });

      const troca = await auth.trocarSenhaEntregador(
        { usuarioId: cpf, cargo: login.usuario.cargo },
        {
          senhaAtual: senhaTemporaria,
          novaSenha: NOVA_SENHA,
          cienteDadosCompartilhados: true,
        },
      );

      await expect(validar(login.tokenAcesso)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(validar(troca.tokenAcesso)).resolves.toMatchObject({
        senhaTemporaria: false,
      });
      const entregador = await gravado(cpf);
      expect(entregador.senha_temporaria).toBe(false);
      expect(entregador.sessao_versao).toBe(1);
      expect(entregador.ciencia_dados_em).toBeInstanceOf(Date);
    });

    it('depois da troca, so a senha nova entra', async () => {
      const { cpf, senhaTemporaria } = await cadastrar();
      await auth.trocarSenhaEntregador(
        {
          usuarioId: cpf,
          cargo: (await auth.loginEntregador({ cpf, senha: senhaTemporaria }))
            .usuario.cargo,
        },
        {
          senhaAtual: senhaTemporaria,
          novaSenha: NOVA_SENHA,
          cienteDadosCompartilhados: true,
        },
      );

      await expect(
        auth.loginEntregador({ cpf, senha: senhaTemporaria }),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        auth.loginEntregador({ cpf, senha: NOVA_SENHA }),
      ).resolves.toMatchObject({ usuario: { senhaTemporaria: false } });
      await expect(
        entregadores.gerarNovaSenhaTemporaria(idEmpresa, cpf),
      ).rejects.toThrow(NotFoundException);
    });

    it('senha temporaria vencida nao entra mesmo estando certa', async () => {
      const { cpf, senhaTemporaria } = await cadastrar();
      await banco.prisma.entregador.update({
        where: { cpf },
        data: { senha_temporaria_expira_em: new Date(Date.now() - HORA_MS) },
      });

      await expect(
        auth.loginEntregador({ cpf, senha: senhaTemporaria }),
      ).rejects.toThrow('Senha temporaria expirada');
    });

    it('a empresa que cadastrou gera outra senha temporaria e a anterior para de valer', async () => {
      const { cpf, senhaTemporaria } = await cadastrar();

      const nova = await entregadores.gerarNovaSenhaTemporaria(idEmpresa, cpf);

      await expect(
        auth.loginEntregador({ cpf, senha: senhaTemporaria }),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        auth.loginEntregador({ cpf, senha: nova.senhaTemporaria }),
      ).resolves.toMatchObject({ usuario: { senhaTemporaria: true } });
    });

    it('sair de todos os aparelhos invalida o token ja emitido', async () => {
      const { cpf, senhaTemporaria } = await cadastrar();
      const login = await auth.loginEntregador({ cpf, senha: senhaTemporaria });

      await auth.sairDeTodosOsAparelhos({
        usuarioId: cpf,
        cargo: login.usuario.cargo,
      });

      await expect(validar(login.tokenAcesso)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  },
);
