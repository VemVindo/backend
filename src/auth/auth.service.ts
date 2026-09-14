import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UserRole } from '../common/enums/user-role.enum';
import { EmpresaRepository } from '../empresa/empresa.repository';
import { EntregadorRepository } from '../entregador/entregador.repository';
import { Empresa, Entregador } from '../generated/prisma/client';
import { LoginEmpresaDto } from './dto/login.dto';
import { LoginEntregadorDto } from './dto/login-entregador.dto';
import { RegisterEstablishmentDto } from './dto/register-establishment.dto';

const SALT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly empresas: EmpresaRepository,
    private readonly entregadores: EntregadorRepository,
    private readonly jwtService: JwtService,
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

    const senhaHash = await bcrypt.hash(dto.senha, SALT_ROUNDS);
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
    if (!empresa || !(await bcrypt.compare(dto.senha, empresa.senha))) {
      throw new UnauthorizedException('Credenciais invalidas');
    }
    return this.buildEmpresaResponse(empresa);
  }

  async loginEntregador(dto: LoginEntregadorDto) {
    const entregador = await this.entregadores.findByCpf(dto.cpf);
    if (!entregador || !(await bcrypt.compare(dto.senha, entregador.senha))) {
      throw new UnauthorizedException('Credenciais invalidas');
    }
    return this.buildEntregadorResponse(entregador);
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
      sub: String(entregador.id_entregador),
      role: UserRole.ENTREGADOR,
    });

    return {
      accessToken,
      user: {
        id: entregador.id_entregador,
        nome: entregador.nome,
        cpf: entregador.cpf,
        role: UserRole.ENTREGADOR,
      },
    };
  }
}
