import { ConflictException, Injectable } from '@nestjs/common';
import { coordenada } from '../mapa/dto/visao-da-entrega.dto';
import { RotaDeCarroService } from '../mapa/rota-de-carro.service';
import { CalculoValorEntregaService } from '../remuneracao/calculo-valor-entrega.service';
import { RemuneracaoService } from '../remuneracao/remuneracao.service';
import { CriarPedidoDto } from './dto/criar-pedido.dto';

const DISTANCIA_SEM_ROTA = 0;

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
    const distancia = rota?.distanciaM ?? DISTANCIA_SEM_ROTA;
    const destino = rota?.destino ?? destinoInformado;
    return {
      distancia,
      distanciaConhecida: rota !== null,
      destinoLat: destino?.lat ?? null,
      destinoLng: destino?.lng ?? null,
      valorEntrega: this.calculoValorEntregaService.calcularValorEntrega({
        distanciaMetros: distancia,
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
