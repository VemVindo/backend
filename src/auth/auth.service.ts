import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PasswordService } from '../common/security/password.service';
import { UserRole } from '../common/enums/user-role.enum';
import { EmpresaRepository } from '../empresa/empresa.repository';
import { EntregadorRepository } from '../entregador/entregador.repository';
import { Empresa, Entregador } from '../generated/prisma/client';
import { AuthenticatedUser } from './jwt.strategy';
import { LoginEmpresaDto } from './dto/login.dto';
import { LoginEntregadorDto } from './dto/login-entregador.dto';
import { RegisterEstablishmentDto } from './dto/register-establishment.dto';
import { TrocarSenhaDto } from './dto/trocar-senha.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly empresas: EmpresaRepository,
    private readonly entregadores: EntregadorRepository,
    private readonly jwtService: JwtService,
    private readonly password: PasswordService,
  ) {}

  async registerEstablishment(dto: RegisterEstablishmentDto) {
    if (!dto.cnpj && !dto.cpf) {
      throw new BadRequestException('Informe CNPJ ou CPF');
    }
    if (dto.cnpj && !dto.razaoSocial) {
      throw new BadRequestException('Razao social e obrigatoria para CNPJ');
    }

    const [emailTaken, documentoTaken] = await Promise.all([
      this.empresas.findByEmail(dto.email),
      this.empresas.findByDocumento(dto.cnpj ?? null, dto.cpf ?? null),
    ]);
    if (emailTaken) {
      throw new ConflictException('E-mail ja cadastrado');
    }
    if (documentoTaken) {
      throw new ConflictException('Documento ja cadastrado');
    }

    const senhaHash = await this.password.hash(dto.senha);
    const empresa = await this.empresas.create({
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

    return this.buildEmpresaResponse(empresa);
  }

  async loginEmpresa(dto: LoginEmpresaDto) {
    const empresa = await this.empresas.findByEmail(dto.email);
    if (!empresa || !(await this.password.compare(dto.senha, empresa.senha))) {
      throw new UnauthorizedException('Credenciais invalidas');
    }
    return this.buildEmpresaResponse(empresa);
  }

  async loginEntregador(dto: LoginEntregadorDto) {
    const entregador = await this.entregadores.findByCpf(dto.cpf);
    if (
      !entregador ||
      !(await this.password.compare(dto.senha, entregador.senha))
    ) {
      throw new UnauthorizedException('Credenciais invalidas');
    }
    return this.buildEntregadorResponse(entregador);
  }

  async getMe(user: AuthenticatedUser) {
    if (user.role === UserRole.ESTABELECIMENTO) {
      const empresa = await this.empresas.findById(Number(user.userId));
      if (!empresa) {
        throw new UnauthorizedException();
      }
      return {
        id: empresa.id_empresa,
        nomeFantasia: empresa.nome_fantasia,
        email: empresa.email,
        role: UserRole.ESTABELECIMENTO,
      };
    }

    const entregador = await this.entregadores.findByCpf(user.userId);
    if (!entregador) {
      throw new UnauthorizedException();
    }
    return {
      cpf: entregador.cpf,
      nome: entregador.nome,
      role: UserRole.ENTREGADOR,
      senhaTemporaria: entregador.senha_temporaria,
    };
  }

  async trocarSenhaEntregador(user: AuthenticatedUser, dto: TrocarSenhaDto) {
    const entregador = await this.entregadores.findByCpf(user.userId);
    if (!entregador) {
      throw new UnauthorizedException();
    }
    const senhaConfere = await this.password.compare(
      dto.senhaAtual,
      entregador.senha,
    );
    if (!senhaConfere) {
      throw new UnauthorizedException('Senha atual invalida');
    }

    const novaHash = await this.password.hash(dto.novaSenha);
    await this.entregadores.updateSenha(entregador.cpf, novaHash);
    return { senhaAtualizada: true };
  }

  private buildEmpresaResponse(empresa: Empresa) {
    const establishmentId = String(empresa.id_empresa);
    const accessToken = this.jwtService.sign({
      sub: establishmentId,
      role: UserRole.ESTABELECIMENTO,
      establishmentId,
    });

    return {
      accessToken,
      user: {
        id: empresa.id_empresa,
        nomeFantasia: empresa.nome_fantasia,
        email: empresa.email,
        role: UserRole.ESTABELECIMENTO,
      },
    };
  }

  private buildEntregadorResponse(entregador: Entregador) {
    const accessToken = this.jwtService.sign({
      sub: entregador.cpf,
      role: UserRole.ENTREGADOR,
    });

    return {
      accessToken,
      user: {
        cpf: entregador.cpf,
        nome: entregador.nome,
        role: UserRole.ENTREGADOR,
        senhaTemporaria: entregador.senha_temporaria,
      },
    };
  }
}
