import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SenhaService } from '../common/security/senha.service';
import { Cargo } from '../common/enums/user-role.enum';
import { EmpresaRepository } from '../empresa/empresa.repository';
import { EntregadorRepository } from '../entregador/entregador.repository';
import { Empresa, Entregador } from '../generated/prisma/client';
import { violouUnicidade } from '../prisma/prisma-errors';
import { UsuarioAutenticado, JwtPayload } from './jwt.strategy';
import { LoginEmpresaDto } from './dto/login.dto';
import { LoginEntregadorDto } from './dto/login-entregador.dto';
import { RegistrarEmpresa } from './dto/register-establishment.dto';
import { TrocarSenhaDto } from './dto/trocar-senha.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly empresas: EmpresaRepository,
    private readonly entregadores: EntregadorRepository,
    private readonly jwtService: JwtService,
    private readonly senha: SenhaService,
  ) {}

  async cadastrarEmpresa(dto: RegistrarEmpresa) {
    if (!dto.cnpj === !dto.cpf) {
      throw new BadRequestException('Informe CNPJ ou CPF, apenas um deles');
    }
    if (dto.cnpj && !dto.razaoSocial) {
      throw new BadRequestException('Razao social e obrigatoria para CNPJ');
    }

    const [email, documento] = await Promise.all([
      this.empresas.procurarPorEmail(dto.email),
      this.empresas.procurarPorDocumento(dto.cnpj ?? null, dto.cpf ?? null),
    ]);
    if (email) {
      throw new ConflictException('E-mail ja cadastrado');
    }
    if (documento) {
      throw new ConflictException('Documento ja cadastrado');
    }

    const senhaHash = await this.senha.hash(dto.senha);
    let empresa: Empresa;
    try {
      empresa = await this.empresas.criar({
        nomeFantasia: dto.nomeFantasia,
        email: dto.email,
        telefone: dto.telefone,
        cnpj: dto.cnpj ?? null,
        cpf: dto.cpf ?? null,
        cep: dto.cep,
        logradouro: dto.logradouro,
        numero: dto.numero,
        complemento: dto.complemento ?? null,
        bairro: dto.bairro,
        cidade: dto.cidade,
        uf: dto.uf,
        razaoSocial: dto.razaoSocial ?? null,
        senhaHash,
      });
    } catch (erro) {
      if (violouUnicidade(erro)) {
        throw new ConflictException('E-mail ou documento ja cadastrado');
      }
      throw erro;
    }

    return this.buildEmpresaResponse(empresa);
  }

  async loginEmpresa(dto: LoginEmpresaDto) {
    const empresa = await this.empresas.procurarPorEmail(dto.email);
    const senhaConfere = await this.senha.verificar(dto.senha, empresa?.senha);
    if (!empresa || !senhaConfere) {
      throw new UnauthorizedException('Credenciais invalidas');
    }
    return this.buildEmpresaResponse(empresa);
  }

  async loginEntregador(dto: LoginEntregadorDto) {
    const entregador = await this.entregadores.procurarPorCpf(dto.cpf);
    const senhaConfere = await this.senha.verificar(
      dto.senha,
      entregador?.senha,
    );
    if (!entregador || !senhaConfere) {
      throw new UnauthorizedException('Credenciais invalidas');
    }
    return this.buildEntregadorResponse(entregador);
  }

  async minhasInformacoes(usuario: UsuarioAutenticado) {
    if (usuario.cargo === Cargo.ESTABELECIMENTO) {
      const empresa = await this.empresas.procurarPorId(Number(usuario.usuarioId));
      if (!empresa) {
        throw new UnauthorizedException();
      }
      return {
        id: empresa.id_empresa,
        nomeFantasia: empresa.nome_fantasia,
        email: empresa.email,
        cargo: Cargo.ESTABELECIMENTO,
      };
    }

    const entregador = await this.entregadores.procurarPorCpf(usuario.usuarioId);
    if (!entregador) {
      throw new UnauthorizedException();
    }
    return {
      cpf: entregador.cpf,
      nome: entregador.nome,
      cargo: Cargo.ENTREGADOR,
      senhaTemporaria: entregador.senha_temporaria,
    };
  }

  async trocarSenhaEntregador(usuario: UsuarioAutenticado, dto: TrocarSenhaDto) {
    const entregador = await this.entregadores.procurarPorCpf(usuario.usuarioId);
    if (!entregador) {
      throw new UnauthorizedException();
    }
    const senhaConfere = await this.senha.comparar(
      dto.senhaAtual,
      entregador.senha,
    );
    if (!senhaConfere) {
      throw new UnauthorizedException('Senha atual invalida');
    }
    if (dto.novaSenha === dto.senhaAtual) {
      throw new BadRequestException(
        'A nova senha precisa ser diferente da atual',
      );
    }

    const novaHash = await this.senha.hash(dto.novaSenha);
    await this.entregadores.atualizarSenha(entregador.cpf, novaHash);
    return this.buildEntregadorResponse({
      ...entregador,
      senha_temporaria: false,
    });
  }

  private assinar(payload: JwtPayload) {
    const tokenAcesso = this.jwtService.sign(payload);
    const { exp } = this.jwtService.decode<{ exp: number }>(accessToken);
    return { tokenAcesso, expiraEm: new Date(exp * 1000) };
  }

  private buildEmpresaResponse(empresa: Empresa) {
    const empresaId = String(empresa.id_empresa);
    const token = this.assinar({
      sub: empresaId,
      cargo: Cargo.ESTABELECIMENTO,
      empresaId,
    });

    return {
      ...token,
      usuario: {
        id: empresa.id_empresa,
        nomeFantasia: empresa.nome_fantasia,
        email: empresa.email,
        cargo: Cargo.ESTABELECIMENTO,
      },
    };
  }

  private buildEntregadorResponse(entregador: Entregador) {
    const token = this.assinar({
      sub: entregador.cpf,
      cargo: Cargo.ENTREGADOR,
      senhaTemporaria: entregador.senha_temporaria,
    });

    return {
      ...token,
      usuario: {
        cpf: entregador.cpf,
        nome: entregador.nome,
        cargo: Cargo.ENTREGADOR,
        senhaTemporaria: entregador.senha_temporaria,
      },
    };
  }
}
