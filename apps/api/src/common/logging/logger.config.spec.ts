import { randomBytes } from 'node:crypto';
import pino, { type LoggerOptions } from 'pino';
import { validateEnv } from '../../config/env.validation';
import { buildLoggerParams } from './logger.config';

const k = (): string => randomBytes(32).toString('base64');
const env = validateEnv({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://x',
  APP_ENCRYPTION_KEY: k(),
  SESSION_SECRET: k(),
  MEDIA_SIGNING_SECRET: k(),
});

describe('buildLoggerParams', () => {
  it('redacta tokens en objetos y en errores', () => {
    const lines: string[] = [];
    const options = { ...(buildLoggerParams(env).pinoHttp as LoggerOptions), transport: undefined };
    const logger = pino(options, { write: (l: string) => lines.push(l) });

    logger.info({ account: { access_token: 'EAAsecret', refreshToken: 'r1tok' } }, 'saved');
    logger.error(
      { err: new Error('GET https://graph.facebook.com/me?access_token=EAAsecret2 ECONNRESET') },
      'fail',
    );

    const out = lines.join('\n');
    expect(out).not.toMatch(/EAAsecret|r1tok|EAAsecret2/);
    expect(out).toContain('[REDACTED]');
  });

  it('usa el nivel de log configurado', () => {
    expect((buildLoggerParams(env).pinoHttp as LoggerOptions).level).toBe('info');
  });
});
