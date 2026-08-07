import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });

  // Shared with the e2e suite, so the tests exercise this exact server.
  configureApp(app);

  const port = app.get(ConfigService).get<number>('PORT', 4100);
  await app.listen(port, '0.0.0.0');
  new Logger('Bootstrap').log(`SUKI sync API listening on :${port}`);
}

void bootstrap();
