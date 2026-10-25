import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { StatusPedido } from '../generated/prisma/enums';
import { ConversaWhatsappDto } from './dto/conversa-whatsapp.dto';
import {
  DonoDoPedido,
  PedidoComContatos,
  PedidoRepository,
} from './pedido.repository';
import {
  DadosDaConversa,
  montarLinkWhatsapp,
  textoDaEmpresaParaEntregador,
  textoDaEmpresaParaRecebedor,
  textoDoEntregadorParaEmpresa,
} from './whatsapp';

const STATUS_COM_CONVERSA_DO_RECEBEDOR: readonly StatusPedido[] = [
  StatusPedido.PENDENTE,
  StatusPedido.EM_ANDAMENTO,
];

@Injectable()
export class ConversaDoPedidoService {
  constructor(private readonly pedidoRepository: PedidoRepository) {}

  async conversaComEntregador(
    idEmpresa: number,
    idPedido: number,
  ): Promise<ConversaWhatsappDto> {
    const { pedido, dados } = await this.prepararConversa(idPedido, {
      idEmpresa,
    });
    return {
      link: this.exigirLink(
        pedido.entregador.telefone,
        textoDaEmpresaParaEntregador(dados),
      ),
      contato: dados.entregador,
    };
  }

  async conversaComEstabelecimento(
    cpfEntregador: string,
    idPedido: number,
  ): Promise<ConversaWhatsappDto> {
    const { pedido, dados } = await this.prepararConversa(idPedido, {
      cpf_entregador: cpfEntregador,
    });
    return {
      link: this.exigirLink(
        pedido.empresa.telefone,
        textoDoEntregadorParaEmpresa(dados),
      ),
      contato: dados.empresa,
    };
  }

  async conversaComRecebedor(
    idEmpresa: number,
    idPedido: number,
  ): Promise<ConversaWhatsappDto> {
    const pedido = await this.pedidoRepository.procurarComContatos(idPedido, {
      idEmpresa,
    });
    if (!pedido) {
      throw new NotFoundException('Pedido não encontrado');
    }
    if (!STATUS_COM_CONVERSA_DO_RECEBEDOR.includes(pedido.status)) {
      throw new ConflictException(
        'A conversa com o recebedor só fica disponível enquanto o pedido está aberto',
      );
    }
    return {
      link: this.exigirLink(
        pedido.telefone_recebedor,
        textoDaEmpresaParaRecebedor({
          idPedido: pedido.id_pedido,
          empresa: pedido.empresa.nome_fantasia,
          recebedor: pedido.nome_recebedor,
        }),
      ),
      contato: pedido.nome_recebedor,
    };
  }

  private async prepararConversa(idPedido: number, dono: DonoDoPedido) {
    const pedido = await this.pedidoRepository.procurarComContatos(
      idPedido,
      dono,
    );
    if (!pedido) {
      throw new NotFoundException('Pedido não encontrado');
    }
    if (!conversaDisponivel(pedido)) {
      throw new ConflictException(
        'A conversa pelo WhatsApp só fica disponível com a entrega em andamento',
      );
    }

    const dados: DadosDaConversa = {
      idPedido: pedido.id_pedido,
      empresa: pedido.empresa.nome_fantasia,
      entregador: pedido.entregador.nome,
    };
    return { pedido, dados };
  }

  private exigirLink(telefone: string, texto: string): string {
    const link = montarLinkWhatsapp(telefone, texto);
    if (!link) {
      throw new UnprocessableEntityException(
        'O telefone cadastrado não é válido para o WhatsApp',
      );
    }
    return link;
  }
}

type PedidoEmConversa = PedidoComContatos & {
  entregador: NonNullable<PedidoComContatos['entregador']>;
};

function conversaDisponivel(
  pedido: PedidoComContatos,
): pedido is PedidoEmConversa {
  return pedido.status === StatusPedido.EM_ANDAMENTO && !!pedido.entregador;
}
