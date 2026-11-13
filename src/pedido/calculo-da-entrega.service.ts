import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { coordenada } from '../mapa/dto/visao-da-entrega.dto';
import { RotaDeCarroService } from '../mapa/rota-de-carro.service';
import { CalculoValorEntregaService } from '../remuneracao/calculo-valor-entrega.service';
import { RemuneracaoService } from '../remuneracao/remuneracao.service';
import { CriarPedidoDto } from './dto/criar-pedido.dto';

export interface EntregaCalculada {
  distancia: number;
  distanciaConhecida: boolean;
  destinoLat: number | null;
  destinoLng: number | null;
  valorEntrega: number;
}

interface ParametrosVigentes {
  taxaFixa: number;
  coeficienteKm: number;
}

@Injectable()
export class CalculoDaEntregaService {
  constructor(
    private readonly remuneracaoService: RemuneracaoService,
    private readonly calculoValorEntregaService: CalculoValorEntregaService,
    private readonly rotaDeCarro: RotaDeCarroService,
  ) {}

  async calcular(
    idEmpresa: number,
    pedido: CriarPedidoDto,
  ): Promise<EntregaCalculada> {
    const { taxaFixa, coeficienteKm } = await this.exigirParametros(idEmpresa);
    if ((pedido.destino_lat != null) !== (pedido.destino_lng != null)) {
      throw new BadRequestException(
        'Informe latitude e longitude do pino no mapa para localizar a entrega',
      );
    }
    const destinoInformado = coordenada(
      pedido.destino_lat ?? null,
      pedido.destino_lng ?? null,
    );
    const rota = await this.rotaDeCarro.calcular(
      idEmpresa,
      pedido,
      pedido.tipo_veiculo,
      destinoInformado,
    );
    const destino = rota?.destino ?? destinoInformado;
    if (!destino) {
      throw new BadRequestException(
        'Não foi possível localizar o endereço da entrega. Marque o pino no local correto do mapa para continuar.',
      );
    }
    if (!rota || rota.distanciaM <= 0) {
      throw new ConflictException(
        'Não foi possível calcular uma distância válida para a entrega. Confira a localização do estabelecimento e do pino no mapa.',
      );
    }
    return {
      distancia: rota.distanciaM,
      distanciaConhecida: true,
      destinoLat: destino.lat,
      destinoLng: destino.lng,
      valorEntrega: this.calculoValorEntregaService.calcularValorEntrega({
        distanciaMetros: rota.distanciaM,
        taxaFixaCentavos: taxaFixa,
        coeficienteCentavosKm: coeficienteKm,
      }),
    };
  }

  distanciaParaFinalizar(idPedido: number): Promise<number | null> {
    return this.rotaDeCarro.distanciaParaFinalizar(idPedido);
  }

  private async exigirParametros(
    idEmpresa: number,
  ): Promise<ParametrosVigentes> {
    const { taxaFixa, coeficienteKm } =
      await this.remuneracaoService.consultar(idEmpresa);
    if (taxaFixa === null || coeficienteKm === null) {
      throw new ConflictException('Parâmetros de remuneração não configurados');
    }
    return { taxaFixa, coeficienteKm };
  }
}
