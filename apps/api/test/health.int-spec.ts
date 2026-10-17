import { randomBytes } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureApp } from '../src/app.setup';
import { startTestDatabase, type TestDatabase } from './support/postgres';

describe('GET /healthz', () => {
  let db: TestDatabase;
  let app: INestApplication;

  beforeAll(async () => {
    db = await startTestDatabase();
    const key = (): string => randomBytes(32).toString('base64');
    Object.assign(process.env, {
      NODE_ENV: 'test',
      LOG_LEVEL: 'fatal',
      DATABASE_URL: db.url,
      APP_ENCRYPTION_KEY: key(),
      SESSION_SECRET: key(),
      MEDIA_SIGNING_SECRET: key(),
    });
    // ConfigModule valida el entorno al importarse: AppModule debe cargarse después de definirlo.
    const { AppModule } = await import('../src/app.module.js');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ bufferLogs: true });
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('responde 200 { ok: true } con la base de datos disponible', async () => {
    const res = await request(app.getHttpServer()).get('/healthz').expect(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('responde 503 { ok: false } si la base de datos cae, sin detalles', async () => {
    await db.stop();
    const res = await request(app.getHttpServer()).get('/healthz').expect(503);
    expect(res.body).toEqual({ ok: false });
  });
});
