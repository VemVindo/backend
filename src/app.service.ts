import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  saudar(): string {
    return 'Hello World!';
  }
}
