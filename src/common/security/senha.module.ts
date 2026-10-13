import { Global, Module } from '@nestjs/common';
import { SenhaService } from './senha.service';

@Global()
@Module({
  providers: [SenhaService],
  exports: [SenhaService],
})
export class SenhaModule {}
