import { Controller, Post, Body } from '@nestjs/common';
import { PedidoService } from './pedido.service';
import { CriaPedidoReqDto, CriaPedidoResDto } from './dto/cria-pedido.dto';
import { plainToInstance } from 'class-transformer';

@Controller('pedido')
export class PedidoController {
  constructor(private readonly pedidoService: PedidoService) {}

  @Post('criar')
  async criar(@Body() pedidoDto: CriaPedidoReqDto): Promise<CriaPedidoResDto> {
    const pedido = await this.pedidoService.criar(pedidoDto);
    return plainToInstance(CriaPedidoResDto, pedido);
  }
}
