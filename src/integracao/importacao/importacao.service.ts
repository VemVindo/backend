import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  MetricasPagamento,
  PedidoImportado,
} from '../../generated/prisma/client';
import { StatusFactory } from '../../pedido/factories/status.factory';
import { violouUnicidade } from '../../prisma/prisma-errors';
import { CalculoValorEntregaService } from '../../remuneracao/calculo-valor-entrega.service';
import {
  AnalisePedidoExterno,
  DadosPedidoExterno,
  analisarPedidoExterno,
  ehObjetoSimples,
  idExternoValido,
} from './analise-pedido-externo';
import { PedidoExternoDto } from './dto/pedido-externo.dto';
import {
  DadosNovoPedido,
  ImportacaoRepository,
  PendenciaJaConvertida,
} from './importacao.repository';

const DISTANCIA_SEM_API_DE_MAPAS = 0;
const VALOR_SEM_PARAMETROS_DE_REMUNERACAO = 0;
const MOTIVO_ITEM_NAO_E_OBJETO = 'Pedido deve ser um objeto';
const MOTIVO_ID_EXTERNO_INVALIDO =
  'idExterno obrigatorio: ate 100 letras, numeros, _ . : ou -';

type ResultadoInvalido = {
  idExterno: null;
  situacao: 'invalido';
  motivo: string;
};

export type ResultadoImportacao =
  | { idExterno: string; situacao: 'importado'; idPedido: number }
  | {
      idExterno: string;
      situacao: 'incompleto';
      idPendencia: number;
      camposFaltantes: string[];
    }
  | { idExterno: string; situacao: 'duplicado' }
  | ResultadoInvalido;

interface ItemDoLote {
  idExterno: string;
  campos: Record<string, unknown>;
}

interface PedidoPreparado {
  analise: AnalisePedidoExterno;
  pedido: DadosNovoPedido | null;
  camposFaltantes: string[];
}

@Injectable()
export class ImportacaoService {
  constructor(
    private readonly importacoes: ImportacaoRepository,
    private readonly calculoValor: CalculoValorEntregaService,
  ) {}

  async importar(idEmpresa: number, itens: unknown[]) {
    const resultados: ResultadoImportacao[] = [];
    for (const item of itens) {
      resultados.push(await this.importarItem(idEmpresa, item));
    }
    return { resumo: resumir(resultados), resultados };
  }

  async listarPendencias(idEmpresa: number) {
    const pendencias = await this.importacoes.listarPendencias(idEmpresa);
    return pendencias.map(paraPendencia);
  }

  async completar(
    idEmpresa: number,
    idPendencia: number,
    complemento: Record<string, unknown>,
  ) {
    const pendencia = await this.exigirPendencia(idPendencia, idEmpresa);
    const { analise, pedido, camposFaltantes } = await this.prepararPedido(
      idEmpresa,
      { ...(pendencia.dados as object), ...complemento },
    );
    if (!pedido) {
      return this.recusarPendenciaIncompleta(
        idPendencia,
        analise.dados,
        camposFaltantes,
      );
    }
    return this.converterEmPedido(
      idPendencia,
      idEmpresa,
      analise.dados,
      pedido,
    );
  }

  private async importarItem(
    idEmpresa: number,
    item: unknown,
  ): Promise<ResultadoImportacao> {
    const lido = lerItemDoLote(item);
    if ('situacao' in lido) {
      return lido;
    }
    if (
      await this.importacoes.procurarPorIdExterno(idEmpresa, lido.idExterno)
    ) {
      return { idExterno: lido.idExterno, situacao: 'duplicado' };
    }
    return this.registrarSemDuplicar(idEmpresa, lido);
  }

  private async registrarSemDuplicar(
    idEmpresa: number,
    item: ItemDoLote,
  ): Promise<ResultadoImportacao> {
    try {
      return await this.registrar(idEmpresa, item);
    } catch (erro) {
      if (violouUnicidade(erro)) {
        return { idExterno: item.idExterno, situacao: 'duplicado' };
      }
      throw erro;
    }
  }

  private async registrar(
    idEmpresa: number,
    { idExterno, campos }: ItemDoLote,
  ): Promise<ResultadoImportacao> {
    const { analise, pedido, camposFaltantes } = await this.prepararPedido(
      idEmpresa,
      campos,
    );
    if (pedido) {
      const criado = await this.importacoes.criarPedidoImportado(
        idEmpresa,
        idExterno,
        analise.dados,
        pedido,
      );
      return { idExterno, situacao: 'importado', idPedido: criado.id_pedido };
    }
    const pendencia = await this.importacoes.criarPendencia(
      idEmpresa,
      idExterno,
      analise.dados,
      camposFaltantes,
    );
    return {
      idExterno,
      situacao: 'incompleto',
      idPendencia: pendencia.id_importacao,
      camposFaltantes,
    };
  }

  private async exigirPendencia(
    idPendencia: number,
    idEmpresa: number,
  ): Promise<PedidoImportado> {
    const pendencia = await this.importacoes.procurarPendencia(
      idPendencia,
      idEmpresa,
    );
    if (!pendencia) {
      throw pendenciaNaoEncontrada();
    }
    return pendencia;
  }

  private async recusarPendenciaIncompleta(
    idPendencia: number,
    dados: DadosPedidoExterno,
    camposFaltantes: string[],
  ): Promise<never> {
    await this.importacoes.atualizarPendencia(
      idPendencia,
      dados,
      camposFaltantes,
    );
    throw new UnprocessableEntityException({
      message: 'Ainda faltam dados para criar o pedido',
      camposFaltantes,
    });
  }

  private async converterEmPedido(
    idPendencia: number,
    idEmpresa: number,
    dados: DadosPedidoExterno,
    pedido: DadosNovoPedido,
  ) {
    try {
      const criado = await this.importacoes.converterPendencia(
        idPendencia,
        idEmpresa,
        dados,
        pedido,
      );
      return { idPedido: criado.id_pedido };
    } catch (erro) {
      if (erro instanceof PendenciaJaConvertida) {
        throw pendenciaNaoEncontrada();
      }
      throw erro;
    }
  }

  private async prepararPedido(
    idEmpresa: number,
    campos: Record<string, unknown>,
  ): Promise<PedidoPreparado> {
    const analise = analisarPedidoExterno(campos);
    const { camposFaltantes } = analise;
    if (camposFaltantes.length > 0) {
      return { analise, pedido: null, camposFaltantes };
    }
    const metricas = await this.importacoes.procurarMetricasVigentes(
      idEmpresa,
      new Date(),
    );
    return {
      analise,
      pedido: this.montarPedido(analise.pedido, metricas),
      camposFaltantes,
    };
  }

  private montarPedido(
    pedido: PedidoExternoDto,
    metricas: MetricasPagamento | null,
  ): DadosNovoPedido {
    return {
      nome_recebedor: pedido.nomeRecebedor,
      telefone_recebedor: pedido.telefoneRecebedor,
      cep: pedido.cep,
      logradouro: pedido.logradouro,
      numero: pedido.numero,
      complemento: pedido.complemento ?? null,
      bairro: pedido.bairro,
      cidade: pedido.cidade,
      uf: pedido.uf,
      descricao: juntarObservacoes(pedido.descricao, pedido.observacoes),
      status: StatusFactory.criar(undefined),
      data_criacao: new Date(),
      distancia: DISTANCIA_SEM_API_DE_MAPAS,
      valor_entrega: this.valorDaEntrega(metricas),
    };
  }

  private valorDaEntrega(metricas: MetricasPagamento | null): number {
    if (!metricas) {
      return VALOR_SEM_PARAMETROS_DE_REMUNERACAO;
    }
    return this.calculoValor.calcular_valor_entrega({
      distancia_metros: DISTANCIA_SEM_API_DE_MAPAS,
      taxa_fixa_centavos: metricas.taxa_fixa,
      coeficiente_centavos_km: metricas.coeficiente,
    });
  }
}

function lerItemDoLote(item: unknown): ItemDoLote | ResultadoInvalido {
  if (!ehObjetoSimples(item)) {
    return invalido(MOTIVO_ITEM_NAO_E_OBJETO);
  }
  const { idExterno, ...campos } = item;
  if (!idExternoValido(idExterno)) {
    return invalido(MOTIVO_ID_EXTERNO_INVALIDO);
  }
  return { idExterno, campos };
}

function invalido(motivo: string): ResultadoInvalido {
  return { idExterno: null, situacao: 'invalido', motivo };
}

function pendenciaNaoEncontrada() {
  return new NotFoundException('Pendencia de importacao nao encontrada');
}

function juntarObservacoes(descricao: string, observacoes?: string): string {
  return observacoes ? `${descricao}\nObservacoes: ${observacoes}` : descricao;
}

function resumir(resultados: ResultadoImportacao[]) {
  const contar = (situacao: ResultadoImportacao['situacao']) =>
    resultados.filter((resultado) => resultado.situacao === situacao).length;
  return {
    recebidos: resultados.length,
    importados: contar('importado'),
    incompletos: contar('incompleto'),
    duplicados: contar('duplicado'),
    invalidos: contar('invalido'),
  };
}

function paraPendencia(pendencia: PedidoImportado) {
  return {
    id: pendencia.id_importacao,
    idExterno: pendencia.id_externo,
    recebidoEm: pendencia.data_recebimento,
    dados: pendencia.dados as DadosPedidoExterno,
    camposFaltantes: pendencia.campos_faltantes,
  };
}
