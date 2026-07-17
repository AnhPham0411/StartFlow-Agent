import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';

const defaults: Record<string, string> = {
  AI_SERVICE_URL: 'http://ai-service:8000',
  CORS_ORIGINS: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://openapi:openapi@localhost:5432/openapi',
  INTERNAL_SERVICE_TOKEN: 'openapi-generation-token',
  KEYCLOAK_AUDIENCE: 'startflow-api',
  KEYCLOAK_ISSUER: 'https://auth.example.invalid/realms/startflow',
  NODE_ENV: 'test',
};

async function generate(): Promise<void> {
  for (const [key, value] of Object.entries(defaults)) process.env[key] ??= value;

  const appModulePath = '../dist/app.module.js';
  const openApiPath = '../dist/openapi.js';
  const [{ AppModule }, { openApiConfig }] = await Promise.all([
    import(appModulePath),
    import(openApiPath),
  ]);
  const app = await NestFactory.create(AppModule, { abortOnError: false, logger: false });
  const document = SwaggerModule.createDocument(app, openApiConfig());
  const outputDirectory = resolve(process.cwd(), 'openapi');
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    resolve(outputDirectory, 'startflow-api.json'),
    `${JSON.stringify(document, null, 2)}\n`,
    'utf8',
  );
  await app.close();
}

generate().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack : 'OpenAPI generation failed');
  process.exitCode = 1;
});
