import { randomBytes } from 'node:crypto';
import { validateEnv } from './env.validation';

const k = (): string => randomBytes(32).toString('base64');
const validKeys = () => ({ APP_ENCRYPTION_KEY: k(), SESSION_SECRET: k(), MEDIA_SIGNING_SECRET: k() });

describe('validateEnv', () => {
  it('aplica valores por defecto', () => {
    const env = validateEnv({ DATABASE_URL: 'postgresql://u:p@localhost:5432/db', ...validKeys() });
    expect(env.HOST).toBe('127.0.0.1');
    expect(env.APP_PORT).toBe(3000);
    expect(env.META_GRAPH_VERSION).toBe('v26.0');
    expect(env.LINKEDIN_API_VERSION).toBe('202609');
    expect(env.MISSED_POST_GRACE_MINUTES).toBe(60);
  });

  it('falla si falta APP_ENCRYPTION_KEY', () => {
    expect(() =>
      validateEnv({ DATABASE_URL: 'postgresql://x', SESSION_SECRET: k(), MEDIA_SIGNING_SECRET: k() }),
    ).toThrow(/APP_ENCRYPTION_KEY/);
  });

  it.each([
    ['hex de 64 caracteres', 'a'.repeat(64)],
    ['31 bytes', randomBytes(31).toString('base64')],
    ['con espacios', ' ' + randomBytes(32).toString('base64')],
  ])('rechaza una clave mal formada (%s) sin filtrar su valor', (_, bad) => {
    let message = '';
    try {
      validateEnv({ DATABASE_URL: 'postgresql://x', ...validKeys(), APP_ENCRYPTION_KEY: bad });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch(/APP_ENCRYPTION_KEY/);
    expect(message).not.toContain(bad.trim());
  });

  it('convierte los puertos de string a number', () => {
    expect(
      validateEnv({ DATABASE_URL: 'postgresql://x', ...validKeys(), APP_PORT: '8080' }).APP_PORT,
    ).toBe(8080);
  });

  it('rechaza PUBLIC_BASE_URL que no sea https', () => {
    expect(() =>
      validateEnv({ DATABASE_URL: 'postgresql://x', ...validKeys(), PUBLIC_BASE_URL: 'http://x.com' }),
    ).toThrow(/PUBLIC_BASE_URL/);
  });
});
