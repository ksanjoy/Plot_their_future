import './load-env.js';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { configureApp, corsOrigins } from './app.setup.js';
import { zodOpenApiConverter } from './openapi.js';
import { ENV, type Env } from './config/config.module.js';
import { RedisIoAdapter } from './realtime/redis-io.adapter.js';
import { RedisService } from './redis/redis.service.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  const env = app.get<Env>(ENV);
  configureApp(app, env);

  const redisAdapter = new RedisIoAdapter(app, () => app.get(RedisService).createConnection(), corsOrigins(env));
  redisAdapter.connect();
  app.useWebSocketAdapter(redisAdapter);

  const doc = new DocumentBuilder()
    .setTitle('Plot Their Future API')
    .setDescription('Wedding microsites, sq.ft. gift registry, RSVPs, WhatsApp dispatch and escrow settlements.')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, () =>
    SwaggerModule.createDocument(app, doc, { standardSchemaConverter: zodOpenApiConverter }),
  );

  await app.listen(env.PORT, '0.0.0.0');
  Logger.log(`API listening on ${env.API_PUBLIC_URL} (docs at ${env.API_PUBLIC_URL}/api/docs)`, 'Bootstrap');
}

await bootstrap();
