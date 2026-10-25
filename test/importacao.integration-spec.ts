import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  SituacaoImportacao,
  StatusPedido,
} from '../src/generated/prisma/enums';
import { ImportacaoRepository } from '../src/integracao/importacao/importacao.repository';
import { ImportacaoService } from '../src/integracao/importacao/importacao.service';
import { RotaDeCarroService } from '../src/mapa/rota-de-carro.service';
import { CalculoValorEntregaService } from '../src/remuneracao/calculo-valor-entrega.service';
import {
  BancoIsolado,
  TEMPO_LIMITE_PREPARACAO_MS,
  cadastrarEmpresa,
  criarBancoIsolado,
  descreverComBanco,
} from './apoio/banco-isolado';

const ROTA_DE_4_KM = { distanciaM: 4200, destino: { lat: -15.81, lng: -47.9 } };

function pedidoExterno(idExterno: string) {
  return {
    idExterno,
    nomeRecebedor: 'Recebedor Importado',
    telefoneRecebedor: '61920000009',
    cep: '70297400',
    logradouro: 'SQS 308 Bloco C',
    numero: 101,
    bairro: 'Asa Sul',
    cidade: 'Brasilia',
    uf: 'DF',
    descricao: 'Pedido importado',
  };
}

descreverComBanco('E-US12 importacao de pedidos no PostgreSQL', () => {
  let banco: BancoIsolado;
  let importacao: ImportacaoService;
  let cantina: number;
  let padaria: number;

  function importadosDa(idEmpresa: number) {
    return banco.prisma.pedidoImportado.findMany({ where: { idEmpresa } });
  }

  function pedidosDa(idEmpresa: number) {
    return banco.prisma.pedido.findMany({ where: { idEmpresa } });
  }

  async function criarPendencia(faltando: Record<string, undefined>) {
    const { resultados } = await importacao.importar(cantina, [
      { ...pedidoExterno(`PEND-${Date.now()}-${Math.random()}`), ...faltando },
    ]);
    const [pendencia] = resultados;
    if (pendencia.situacao !== 'incompleto') {
      throw new Error('o pedido deveria ficar pendente');
    }
    return pendencia.idPendencia;
  }

  beforeAll(async () => {
    banco = await criarBancoIsolado('importacao');
    const rotaDeCarro = { calcular: () => Promise.resolve(ROTA_DE_4_KM) };
    importacao = new ImportacaoService(
      new ImportacaoRepository(banco.prisma),
      new CalculoValorEntregaService(),
      rotaDeCarro as unknown as RotaDeCarroService,
    );
    cantina = await cadastrarEmpresa(banco.prisma, 'cantina');
    padaria = await cadastrarEmpresa(banco.prisma, 'padaria');
    await banco.prisma.metricasPagamento.create({
      data: {
        idEmpresa: cantina,
        taxa_fixa: 800,
        coeficiente: 150,
        data: new Date('2026-01-01T03:00:00Z'),
      },
    });
  }, TEMPO_LIMITE_PREPARACAO_MS);

  beforeEach(async () => {
    await banco.prisma.pedidoImportado.deleteMany();
    await banco.prisma.pedido.deleteMany();
  });

  afterAll(async () => {
    await banco?.encerrar();
  });

  it('grava o pedido e o registro da importacao ligados um ao outro', async () => {
    await importacao.importar(cantina, [pedidoExterno('PED-1')]);

    const [pedido] = await pedidosDa(cantina);
    const [importado] = await importadosDa(cantina);
    expect(pedido).toMatchObject({
      status: StatusPedido.PENDENTE,
      distancia: 4200,
      distancia_conhecida: true,
      valor_entrega: 1430,
      destino_lat: -15.81,
      destino_lng: -47.9,
    });
    expect(importado).toMatchObject({
      id_externo: 'PED-1',
      situacao: SituacaoImportacao.CONVERTIDO,
      idPedido: pedido.id_pedido,
    });
  });

  it('ignora o idEmpresa do corpo e grava na empresa da credencial', async () => {
    await importacao.importar(cantina, [
      { ...pedidoExterno('PED-2'), idEmpresa: padaria },
    ]);

    expect(await pedidosDa(cantina)).toHaveLength(1);
    expect(await pedidosDa(padaria)).toHaveLength(0);
  });

  it('o mesmo idExterno enviado ao mesmo tempo vira um pedido so', async () => {
    const lotes = await Promise.all([
      importacao.importar(cantina, [pedidoExterno('PED-3')]),
      importacao.importar(cantina, [pedidoExterno('PED-3')]),
    ]);

    expect(
      lotes.map(({ resultados }) => resultados[0].situacao).sort(),
    ).toEqual(['duplicado', 'importado']);
    expect(await pedidosDa(cantina)).toHaveLength(1);
    expect(await importadosDa(cantina)).toHaveLength(1);
  });

  it('o mesmo idExterno em empresas diferentes nao e duplicado', async () => {
    await importacao.importar(cantina, [pedidoExterno('PED-4')]);
    const { resultados } = await importacao.importar(padaria, [
      pedidoExterno('PED-4'),
    ]);

    expect(resultados[0].situacao).toBe('importado');
  });

  it('pedido incompleto vira pendencia sem criar pedido', async () => {
    await criarPendencia({ cep: undefined });

    const [pendencia] = await importadosDa(cantina);
    expect(pendencia).toMatchObject({
      situacao: SituacaoImportacao.AGUARDANDO_COMPLETUDE,
      campos_faltantes: ['cep'],
      idPedido: null,
    });
    expect(await pedidosDa(cantina)).toHaveLength(0);
  });

  it('completar com o que falta cria o pedido e fecha a pendencia', async () => {
    const idPendencia = await criarPendencia({ cep: undefined });

    const { idPedido } = await importacao.completar(cantina, idPendencia, {
      cep: '70297400',
    });

    const pendencia = await banco.prisma.pedidoImportado.findUniqueOrThrow({
      where: { id_importacao: idPendencia },
    });
    expect(pendencia).toMatchObject({
      situacao: SituacaoImportacao.CONVERTIDO,
      idPedido,
    });
    await expect(
      importacao.completar(cantina, idPendencia, { cep: '70297400' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('completar so uma parte salva o progresso e continua pendente', async () => {
    const idPendencia = await criarPendencia({
      cep: undefined,
      telefoneRecebedor: undefined,
    });

    await expect(
      importacao.completar(cantina, idPendencia, {
        telefoneRecebedor: '61920000009',
      }),
    ).rejects.toThrow(UnprocessableEntityException);

    const pendencia = await banco.prisma.pedidoImportado.findUniqueOrThrow({
      where: { id_importacao: idPendencia },
    });
    expect(pendencia.campos_faltantes).toEqual(['cep']);
    expect(pendencia.dados).toMatchObject({ telefoneRecebedor: '61920000009' });
  });

  it('outra empresa nao enxerga nem completa a pendencia', async () => {
    const idPendencia = await criarPendencia({ cep: undefined });

    await expect(importacao.listarPendencias(padaria)).resolves.toEqual([]);
    await expect(
      importacao.completar(padaria, idPendencia, { cep: '70297400' }),
    ).rejects.toThrow(NotFoundException);
  });
});
