import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import fastifyStatic from '@fastify/static';
import { join } from 'path';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    { rawBody: true },
  );

  const publicPath = join(__dirname, '..', '..', 'public');
  console.log('📁 Servindo arquivos estáticos de:', publicPath);

  await app.register(fastifyStatic, {
    root: publicPath,
    prefix: '/',
  });

  console.log('✅ fastify-static registrado');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({ origin: '*' });

  const config = new DocumentBuilder()
    .setTitle('Music School API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(3000, '0.0.0.0');
  console.log('🚀 Server running on http://localhost:3000');
}

void bootstrap();
