import { SetMetadata } from '@nestjs/common';
import { Cargo } from '../../common/enums/cargo.enum';

export const CHAVE_CARGOS = 'cargos';

export const Cargos = (...cargos: Cargo[]) => SetMetadata(CHAVE_CARGOS, cargos);
