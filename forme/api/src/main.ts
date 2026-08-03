import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const isProduction = config.get<string>('NODE_ENV') === 'production';

  /**
   * nginx sits in front on the droplet, so without this every client looks
   * like 127.0.0.1 and the sign-in rate limiter would be one shared bucket for
   * the entire internet. `1` — trust exactly one proxy, not any number of
   * spoofable X-Forwarded-For hops.
   */
  app.set('trust proxy', 1);

  app.use(helmet({ contentSecurityPolicy: isProduction ? undefined : false }));
  app.use(cookieParser());

  app.enableCors({
    origin: config
      .get<string>('WEB_ORIGIN', 'http://localhost:3000')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    // Required for the auth cookies to be sent at all.
    credentials: true,
  });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      // Strip unknown properties and reject rather than ignore them, so a
      // client cannot smuggle a field a DTO never declared.
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableShutdownHooks();

  if (!isProduction || config.get<string>('SWAGGER_ENABLED') === 'true') {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('FORME')
        .setDescription('Production API for a trade printer: jobs, preflight, imposition, pricing.')
        .setVersion('1.0')
        .addCookieAuth('forme_access')
        .build(),
    );
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = config.get<number>('PORT', 4000);
  // Bind all interfaces: inside a container loopback would be unreachable from
  // nginx. The port is published to loopback only at the compose layer.
  await app.listen(port, '0.0.0.0');

  new Logger('Bootstrap').log(`FORME API listening on :${port}`);
}

void bootstrap();
