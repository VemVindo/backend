import { Controller, Post, Body } from '@nestjs/common';
import { PedidoService } from './pedido.service';
import { PedidoDto } from './dto/pedido.dto';
import { plainToInstance } from 'class-transformer';

@Controller('pedido')
export class PedidoController {
  constructor(private readonly pedidoService: PedidoService) {}

  @Post('criar')
  async criar(@Body() pedidoDto: PedidoDto): Promise<PedidoDto> {
    const pedido = await this.pedidoService.criar(pedidoDto);
    return plainToInstance(PedidoDto, pedido);
  }
}
