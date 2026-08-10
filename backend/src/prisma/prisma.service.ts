import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    // conecta ao banco quando o módulo inicializa
    await this.$connect();
  }

  async onModuleDestroy() {
    // desconecta quando a aplicação encerra
    await this.$disconnect();
  }
}
