import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildEnvFile } from './setup-lib.mjs';

const EX =
  'POSTGRES_USER=socialhub\nPOSTGRES_PASSWORD=\nPOSTGRES_DB=socialhub\nDATABASE_URL=\n# seguridad\nAPP_ENCRYPTION_KEY=\nSESSION_SECRET=\nMEDIA_SIGNING_SECRET=\nTZ=UTC\n';
const rnd = (n) => Buffer.alloc(n, 7);

test('primera ejecución rellena secretos y DATABASE_URL', () => {
  const { content, generated } = buildEnvFile(EX, null, rnd);
  assert.match(content, /^APP_ENCRYPTION_KEY=.{44}$/m);
  assert.equal(Buffer.from(content.match(/^APP_ENCRYPTION_KEY=(.*)$/m)[1], 'base64').length, 32);
  assert.match(
    content,
    /^DATABASE_URL=postgresql:\/\/socialhub:[A-Za-z0-9_-]+@127\.0\.0\.1:5432\/socialhub$/m,
  );
  assert.deepEqual(generated.sort(), [
    'APP_ENCRYPTION_KEY',
    'DATABASE_URL',
    'MEDIA_SIGNING_SECRET',
    'POSTGRES_PASSWORD',
    'SESSION_SECRET',
  ]);
  assert.match(content, /^# seguridad$/m);
});

test('re-ejecutar no cambia ningún valor existente', () => {
  const first = buildEnvFile(EX, null, rnd).content;
  const second = buildEnvFile(EX, first, () => Buffer.alloc(32, 9));
  assert.equal(second.content, first);
  assert.deepEqual(second.generated, []);
});

test('conserva valores del usuario y variables propias', () => {
  const existing = 'TZ=America/Mexico_City\nAPP_ENCRYPTION_KEY=\nMI_VAR=1\n';
  const { content } = buildEnvFile(EX, existing, rnd);
  assert.match(content, /^TZ=America\/Mexico_City$/m);
  assert.match(content, /^MI_VAR=1$/m);
});

test('la contraseña es segura para URL', () => {
  const { content } = buildEnvFile(EX, null, (n) => Buffer.alloc(n, 0xfb));
  assert.match(content.match(/^POSTGRES_PASSWORD=(.*)$/m)[1], /^[A-Za-z0-9_-]+$/);
});

test('conserva comentarios en línea del ejemplo al rellenar un valor', () => {
  const ex = 'APP_ENCRYPTION_KEY=               # 32 bytes en base64\n';
  const { content } = buildEnvFile(ex, null, rnd);
  assert.match(content, /^APP_ENCRYPTION_KEY=\S{44} +# 32 bytes en base64$/m);
});
