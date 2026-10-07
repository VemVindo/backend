import { SetMetadata } from '@nestjs/common';

export const PERMITIR_SENHA_TEMPORARIA_KEY = 'permitirSenhaTemporaria';

export const PermitirSenhaTemporaria = () =>
  SetMetadata(PERMITIR_SENHA_TEMPORARIA_KEY, true);
