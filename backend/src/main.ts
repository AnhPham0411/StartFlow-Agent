import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { PinoLoggerService } from './common/logging/pino-logger.service';
import type { AppEnvironment } from './config/env.validation';
import { openApiConfig } from './openapi';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });
  const config = app.get(ConfigService<AppEnvironment, true>);
  app.useLogger(app.get(PinoLoggerService));
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      whitelist: true,
    }),
  );
  app.enableCors({
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
    origin: config.get('CORS_ORIGINS', { infer: true }).split(','),
  });
  app.enableShutdownHooks();

  const document = SwaggerModule.createDocument(app, openApiConfig());
  SwaggerModule.setup('docs', app, document, { jsonDocumentUrl: 'docs/openapi.json' });
  await app.listen(config.get('PORT', { infer: true }), '0.0.0.0');
}

void bootstrap();
