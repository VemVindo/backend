import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { EditarEntregadorReqDto } from '../dto/editar-entregador.dto';
import { EntregadorRepository } from '../entregador.repository';

describe('EntregadorRepository', () => {
  let repository: EntregadorRepository;
  describe('editar', () => {
    const dummyReq = {
      nome: {} as string,
      veiculo: {} as string,
      telefone: {} as string,
      placa: {} as string,
      cpf: {} as string,
    } as EditarEntregadorReqDto;
    let mock: jest.Mock;
    beforeEach(async () => {
      mock = jest.fn();
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EntregadorRepository,
          {
            provide: PrismaService,
            useValue: {
              entregador: {
                update: mock,
              },
            },
          },
        ],
      }).compile();
      repository = module.get<EntregadorRepository>(EntregadorRepository);
    });
    it('CAIXA CINZA: Fluxo bem sucedido', async () => {
      mock.mockResolvedValue(true);
      const result = await repository.atualizar(
        dummyReq.cpf,
        dummyReq.nome,
        dummyReq.telefone,
        dummyReq.veiculo,
        dummyReq.placa,
      );
      expect(result).toBe(true);
    });
    it('CAIXA CINZA: Fluxo mal sucedido', async () => {
      mock.mockResolvedValue(false);
      const result = await repository.atualizar(
        dummyReq.cpf,
        dummyReq.nome,
        dummyReq.telefone,
        dummyReq.veiculo,
        dummyReq.placa,
      );
      expect(result).toBe(false);
    });
  });
});
