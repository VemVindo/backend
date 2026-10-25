import { SetMetadata } from '@nestjs/common';

export const CHAVE_PERMITIR_SENHA_TEMPORARIA = 'permitirSenhaTemporaria';

export const PermitirSenhaTemporaria = () =>
  SetMetadata(CHAVE_PERMITIR_SENHA_TEMPORARIA, true);
