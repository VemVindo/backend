import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Maiusculo, Trim } from '../../common/transformers/texto.transformer';
import {
  CARACTERES_PERMITIDOS_SENHA,
  MENSAGEM_CARACTERES_SENHA,
  TAMANHO_MAXIMO_SENHA_BCRYPT,
  TAMANHO_MINIMO_SENHA,
} from '../../common/security/senha.constants';
import { IsCnpj } from '../../common/validators/is-cnpj.validator';
import { IsCpf } from '../../common/validators/is-cpf.validator';
import { AtualizarCadastroDto } from '../../empresa/dto/atualizar-cadastro.dto';

// Os dados editaveis vem de AtualizarCadastroDto; aqui ficam so os que nao
// mudam depois do cadastro (documento e razao social) e a senha.
export class CadastrarEmpresaDto extends AtualizarCadastroDto {
  @Maiusculo()
  @IsOptional()
  @IsCnpj()
  cnpj?: string;

  @IsOptional()
  @IsCpf()
  cpf?: string;

  @Trim()
  @IsString()
  @IsOptional()
  @MaxLength(150)
  razaoSocial?: string;

  @IsString()
  @MinLength(TAMANHO_MINIMO_SENHA)
  @MaxLength(TAMANHO_MAXIMO_SENHA_BCRYPT)
  @Matches(CARACTERES_PERMITIDOS_SENHA, { message: MENSAGEM_CARACTERES_SENHA })
  senha: string;
}
