import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

const SALT_ROUNDS = 12;

@Injectable()
export class PasswordService {
  private hashParaUsuarioInexistente?: Promise<string>;

  hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, SALT_ROUNDS);
  }

  compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  // Sem usuario, compara mesmo assim: o tempo de resposta igual nao revela
  // quais e-mails e CPFs estao cadastrados.
  async verificar(plain: string, hash: string | null | undefined) {
    if (!hash) {
      this.hashParaUsuarioInexistente ??= this.hash(
        randomBytes(16).toString('hex'),
      );
      await bcrypt.compare(plain, await this.hashParaUsuarioInexistente);
      return false;
    }
    return bcrypt.compare(plain, hash);
  }
}
