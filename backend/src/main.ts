import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import fastifyStatic from '@fastify/static';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { join } from 'path';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    { rawBody: true },
  );

  // 1. Seguranca: Headers HTTP (Item 18)
  await app.register(helmet, {
    contentSecurityPolicy: false, // Evita quebrar o Swagger em DEV
  });

  // 2. Seguranca: Rate Limit - Protecao contra Brute Force / DDoS
  await app.register(rateLimit, {
    max: 100, // maximo de 100 requisicoes
    timeWindow: '1 minute', // por minuto por IP
    allowList: (req) => req.url.includes('/payments/webhook'), // Isenta a rota de webhook do Mercado Pago
  });

  const publicPath = join(__dirname, '..', '..', 'public');
  console.log('📁 Servindo arquivos estáticos de:', publicPath);

  await app.register(fastifyStatic, {
    root: publicPath,
    prefix: '/',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true, // Bloqueia Mass Assignment (Item 8 e 14)
      transform: true,
    }),
  );

  // 3. Restringir CORS (Backend + App Mobile)
  const isProduction = process.env.NODE_ENV === 'production';

  app.enableCors({
    origin: (origin, callback) => {
      // !origin libera o App Mobile (iOS/Android), Postman e chamadas diretas
      if (!origin || !isProduction) {
        return callback(null, true);
      }

      // Permite requisições vindas do seu próprio domínio no Railway
      const allowedOrigins = [process.env.APP_URL].filter(Boolean);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Bloqueado pelo CORS'), false);
      }
    },
    credentials: true,
  });

  // 4. Swagger apenas em ambiente de desenvolvimento (Item 15)
  if (!isProduction) {
    const config = new DocumentBuilder()
      .setTitle('Music School API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);
  }

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
  console.log(`🚀 Server running on port ${process.env.PORT ?? 3000}`);
}

void bootstrap();
