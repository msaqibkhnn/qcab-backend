import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import { AppModule } from './app.module';

/** Fail fast with a readable message instead of a cryptic error on first request. */
function assertEnv() {
  const missing = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'].filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Missing required environment variable(s): ${missing.join(', ')}. See .env.example.`);
  }
  if (process.env.NODE_ENV === 'production') {
    const weak = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'].filter(
      (k) => (process.env[k] as string).length < 32 || /change[-_]?me/i.test(process.env[k] as string),
    );
    if (weak.length) {
      throw new Error(`${weak.join(', ')} must be a random string of at least 32 characters in production.`);
    }
  }
}

async function bootstrap() {
  assertEnv();
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // Optional URL prefix, e.g. API_PREFIX=api  ->  /api/auth/register.
  // Leave unset when the app is mounted at the root of its own
  // subdomain (recommended on cPanel: api.yourdomain.com).
  const prefix = (process.env.API_PREFIX ?? '').replace(/^\/+|\/+$/g, '');
  if (prefix) app.setGlobalPrefix(prefix);

  // cPanel/Passenger sits behind a proxy that terminates TLS.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // Stripe requires the exact raw bytes of the request body to verify
  // the webhook signature, so this route gets raw() instead of the
  // json() parser applied to everything else.
  app.use(`${prefix ? '/' + prefix : ''}/webhooks/stripe`, express.raw({ type: 'application/json' }));
  app.use(express.json());

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // CORS_ORIGINS = comma-separated list of allowed browser origins
  // (e.g. https://admin.yourdomain.com). Unset = allow all (the mobile
  // apps are not affected by CORS either way; only browsers are).
  const origins = (process.env.CORS_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  app.enableCors(origins.length ? { origin: origins, credentials: true } : undefined);

  // Under cPanel's Passenger the listen() call is intercepted and the
  // port is ignored; PORT is used when running standalone (npm start).
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
