import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);

  // nginx sits in front on the droplet. Without this every client looks like
  // 127.0.0.1 and the rate limiter is one bucket for the whole internet.
  app.set('trust proxy', 1);
  app.use(helmet());

  app.enableCors({
    origin: config
      .get<string>('WEB_ORIGIN', 'http://localhost:3000')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.enableShutdownHooks();

  const port = config.get<number>('PORT', 4100);
  await app.listen(port, '0.0.0.0');
  new Logger('Bootstrap').log(`SUKI sync API listening on :${port}`);
}

void bootstrap();
