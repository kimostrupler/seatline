import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { setupApp } from './app-setup';
import { loadConfig } from './config';

async function bootstrap() {
  const config = loadConfig();
  // rawBody: Stripe's webhook signature is checked against the exact bytes it sent
  const app = setupApp(
    await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true }),
  );
  app.enableShutdownHooks();
  await app.listen(config.PORT);
}

void bootstrap();
