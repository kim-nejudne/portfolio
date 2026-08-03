import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';

/**
 * Everything that turns a bare Nest app into *this* API: the route prefix, the
 * validation pipe, helmet, CORS, proxy trust.
 *
 * It lives here rather than inside `bootstrap()` so the e2e suite configures
 * its app the identical way. A test that builds the app from `AppModule` alone
 * gets no global prefix and no ValidationPipe — so it would exercise unprefixed
 * routes with validation switched off and report green on a server that does
 * not exist in production. That is the same class of mistake as asserting
 * against the wrong database: a suite testing something adjacent to the thing
 * it claims to test.
 */
export function configureApp(app: INestApplication): INestApplication {
  const config = app.get(ConfigService);

  // nginx sits in front on the droplet. Without this every client looks like
  // 127.0.0.1 and the rate limiter is one bucket for the whole internet.
  (app as NestExpressApplication).set('trust proxy', 1);
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

  return app;
}
