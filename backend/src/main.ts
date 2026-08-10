import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    { rawBody: true }, // necessário pra validar a assinatura HMAC do webhook da AbacatePay
  );

  // valida automaticamente os DTOs nas requisições
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // remove campos que não estão no DTO
      forbidNonWhitelisted: true, // retorna erro se vier campo não permitido
      transform: true, // transforma os tipos automaticamente (string → number, etc)
    }),
  );

  app.enableCors({
    origin: '*', // no MVP liberado pra tudo — vai restringir quando tiver produção
  });

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Music School API') // muda isso
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(3000, '0.0.0.0');
  console.log('🚀 Server running on http://localhost:3000');
}

void bootstrap();
