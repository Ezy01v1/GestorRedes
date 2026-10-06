# Sprint 0 — Fundaciones + spike de riesgos · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar un repositorio que arranca con `npm run setup && docker compose up -d`, sirve `GET /healthz` con la BD migrada, pasa CI, y trae resueltas las tres preguntas abiertas sobre las APIs de Meta.

**Architecture:** Monorepo con npm workspaces. En este sprint solo existe `apps/api` (NestJS); `apps/web` y `packages/shared` llegan en los sprints 1 y 2. La infraestructura transversal se construye con TDD: entorno validado, logs con redacción, errores centralizados, cifrado y firmas. Prisma 7 aplica el schema completo del paso 3 más un SQL adicional, verificado contra un Postgres real con Testcontainers.

**Tech Stack:** Node 24 LTS · TypeScript ≥ 5.9 (strict) · NestJS ≥ 11 · Prisma ≥ 7 + `@prisma/adapter-pg` · PostgreSQL 17 · class-validator · nestjs-pino · Jest + ts-jest + supertest · `@testcontainers/postgresql` · ESLint (flat config, typescript-eslint) + Prettier · commitlint + husky · Docker Compose · GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-05-socialhub-design.md` (+ `docs/design/01…05`). El schema exacto está en `docs/design/03-modelo-datos.md` §3; la estructura de carpetas, en `docs/design/02-arquitectura.md` §5.

## Global Constraints

- Node `24` (`.nvmrc` = `24`, `"engines": { "node": ">=24" }`).
- La app escucha en `HOST` (por defecto `127.0.0.1`) y en `APP_PORT` (por defecto `3000`). Dentro de Docker, `HOST=0.0.0.0`, y compose publica el puerto **solo** en `127.0.0.1`.
- Tokens: AES-256-GCM, formato `iv(12) ‖ tag(16) ‖ ciphertext`, `key_version = 1`.
- Claves `APP_ENCRYPTION_KEY`, `SESSION_SECRET` y `MEDIA_SIGNING_SECRET`: exactamente 32 bytes codificados en base64.
- `META_GRAPH_VERSION` por defecto `v26.0`; `LINKEDIN_API_VERSION` por defecto `202609`.
- Nunca registrar en logs tokens, secretos, `authorization`, `cookie` ni parámetros de query sensibles.
- Los errores HTTP siempre tienen la forma `{ statusCode, code, message, details?, requestId }`.
- Commits convencionales (`feat:`, `fix:`, `docs:`, `test:`, `chore:`, `ci:`, `refactor:`), terminados con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Archivos de texto con fin de línea LF (`.gitattributes`).
- Licencia MIT, titular `Ezy01v1`, año 2026.
- Repositorio remoto: `https://github.com/Ezy01v1/GestorRedes.git`, rama `main`.

## Review Focus

1. **App inalcanzable dentro de Docker** porque escucha en `127.0.0.1` del contenedor → se espera que `http://127.0.0.1:3000/healthz` responda desde el host. Lo cubren el test del valor por defecto de `HOST` (Task 2) y el `curl` de verificación (Task 8).
2. **Ejecutar `npm run setup` dos veces** regenera las claves → se pierden los tokens cifrados y la contraseña de la BD deja de coincidir. Se espera que los valores existentes nunca se toquen. Test en Task 7.
3. **`APP_ENCRYPTION_KEY` mal formada** (hex, 31 bytes, espacios) → se espera un fallo al arrancar que nombre la variable **sin imprimir su valor**. Test en Task 2.
4. **Un token dentro del mensaje de un error** (p. ej. una URL de Graph con `access_token=` en un error de red) → se espera que el log lo muestre redactado. Test en Task 3.
5. **CRLF en archivos que ejecuta Linux** (clonado en Windows) → `sh: not found` en el contenedor. Se espera que funcione igual en Windows. Lo cubren `.gitattributes` (Task 1) y la comprobación `git ls-files --eol` (Task 8).

---

## Estructura de archivos de este sprint

```
.
├─ .editorconfig  .gitattributes  .gitignore  .nvmrc  .dockerignore
├─ .env.example   LICENSE  README.md
├─ package.json                      # workspaces + scripts raíz
├─ tsconfig.base.json  eslint.config.mjs  .prettierrc.json  commitlint.config.mjs
├─ .husky/commit-msg
├─ .github/workflows/ci.yml
├─ Dockerfile  docker-compose.yml
├─ scripts/
│  ├─ setup.mjs                      # CLI: lee/escribe .env
│  ├─ setup-lib.mjs                  # buildEnvFile() pura, testeable
│  └─ setup-lib.test.mjs             # node --test
├─ apps/api/
│  ├─ package.json  tsconfig.json  tsconfig.build.json  nest-cli.json
│  ├─ jest.config.ts  jest.integration.config.ts
│  ├─ prisma.config.ts
│  ├─ prisma/schema.prisma
│  ├─ prisma/migrations/<ts>_init/migration.sql
│  ├─ src/
│  │  ├─ main.ts
│  │  ├─ app.module.ts
│  │  ├─ app.setup.ts                # configureApp(app): prefijo, pipes, filtro, helmet
│  │  ├─ config/env.validation.ts
│  │  ├─ common/logging/redaction.ts
│  │  ├─ common/logging/logger.config.ts
│  │  ├─ common/errors/app-error.ts
│  │  ├─ common/errors/all-exceptions.filter.ts
│  │  ├─ common/crypto/token-cipher.ts
│  │  ├─ common/crypto/signed-token.ts
│  │  ├─ common/crypto/crypto.module.ts
│  │  ├─ prisma/prisma.service.ts
│  │  ├─ prisma/prisma.module.ts
│  │  └─ health/health.controller.ts
│  └─ test/
│     ├─ support/postgres.ts         # startTestDatabase()
│     ├─ app.e2e-spec.ts
│     └─ db.int-spec.ts
├─ spikes/meta/                      # SOLO en la rama spike/meta-risks, nunca en main
└─ docs/design/spike-results.md
```

---

### Task 1: Base del monorepo y herramientas

**Files:**
- Create: `package.json`, `.nvmrc`, `.editorconfig`, `.gitattributes`, `.gitignore`, `LICENSE`, `tsconfig.base.json`, `eslint.config.mjs`, `.prettierrc.json`, `commitlint.config.mjs`, `.husky/commit-msg`

**Interfaces:**
- Produces: scripts raíz `lint`, `format`, `typecheck`, `test`, `test:int`, `build` (que delegan con `--workspaces --if-present`); `workspaces: ["apps/*", "packages/*"]`.

- [ ] **Step 1: Crear los archivos de configuración**
  - `.gitattributes`: `* text=auto eol=lf` y `*.png binary`, `*.jpg binary`.
  - `.gitignore`: `node_modules/`, `dist/`, `coverage/`, `*.log`, `.env`, `.env.*`, `!.env.example`, `data/`, `apps/api/src/generated/`.
  - `tsconfig.base.json`: `strict: true`, `noUncheckedIndexedAccess: true`, `target: ES2023`, `module/moduleResolution: node16`, `experimentalDecorators`, `emitDecoratorMetadata`, `skipLibCheck`.
  - ESLint flat config con `typescript-eslint` recommended-type-checked + `eslint-config-prettier`; regla `no-console: error` (los logs pasan por pino).
  - commitlint con `@commitlint/config-conventional`; el hook de husky ejecuta `npx --no -- commitlint --edit "$1"`.
  - `LICENSE`: texto MIT, `Copyright (c) 2026 Ezy01v1`.

- [ ] **Step 2: Instalar las dependencias de desarrollo de la raíz**

Run: `npm install -D typescript eslint typescript-eslint eslint-config-prettier prettier @commitlint/cli @commitlint/config-conventional husky && npx husky init`
Expected: se crea `package-lock.json`; `.husky/` existe.

- [ ] **Step 3: Verificar commitlint**

Run: `echo "cosas varias" | npx commitlint` → Expected: falla con `subject may not be empty` / `type may not be empty`.
Run: `echo "chore: init monorepo" | npx commitlint` → Expected: sale con código 0.

- [ ] **Step 4: Normalizar los fines de línea existentes y hacer commit**

```bash
git add --renormalize . && git add -A
git commit -m "chore: bootstrap monorepo tooling (eslint, prettier, commitlint, MIT)"
```

---

### Task 2: Esqueleto NestJS + validación del entorno

**Files:**
- Create: `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/tsconfig.build.json`, `apps/api/nest-cli.json`, `apps/api/jest.config.ts`, `apps/api/src/config/env.validation.ts`, `apps/api/src/app.module.ts`, `apps/api/src/main.ts`, `.env.example`
- Test: `apps/api/src/config/env.validation.spec.ts`

**Interfaces:**
- Produces:
  - `class EnvironmentVariables` con propiedades tipadas: `NODE_ENV: 'development'|'production'|'test'` (por defecto `development`), `HOST: string` (`127.0.0.1`), `APP_PORT: number` (`3000`), `PUBLIC_GATEWAY_PORT: number` (`3001`), `TZ: string` (`UTC`), `APP_BASE_URL: string` (`http://127.0.0.1:3000`), `DATABASE_URL: string` (obligatoria), `APP_ENCRYPTION_KEY`, `SESSION_SECRET`, `MEDIA_SIGNING_SECRET` (obligatorias, base64 de 32 bytes), `MEDIA_DIR: string` (`./data/media`), `PUBLIC_BASE_URL?: string` (URL https), `META_APP_ID?`, `META_APP_SECRET?`, `INSTAGRAM_APP_ID?`, `INSTAGRAM_APP_SECRET?`, `LINKEDIN_CLIENT_ID?`, `LINKEDIN_CLIENT_SECRET?`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN?`, `META_GRAPH_VERSION` (`v26.0`, patrón `^v\d+\.\d+$`), `LINKEDIN_API_VERSION` (`202609`, patrón `^\d{6}$`), `INBOX_POLL_MINUTES` (`5`, mín. 1), `SNAPSHOT_CRON` (`0 3 * * *`), `MISSED_POST_GRACE_MINUTES` (`60`, mín. 0), `LOG_LEVEL` (`info`; `fatal|error|warn|info|debug|trace`).
  - `function validateEnv(raw: Record<string, unknown>): EnvironmentVariables`: lanza `Error` con el mensaje `Invalid environment configuration: <VAR1>, <VAR2> …` más una línea con la razón de cada una; **nunca incluye los valores**.
  - Decorador `@IsBase64Key(32)` en el mismo archivo.
  - `AppModule` importa `ConfigModule.forRoot({ isGlobal: true, validate: validateEnv })`.

- [ ] **Step 1: Generar el workspace de la API**

Dependencias: `@nestjs/core @nestjs/common @nestjs/platform-express @nestjs/config class-validator class-transformer reflect-metadata rxjs helmet`; de desarrollo: `@nestjs/cli @nestjs/testing jest ts-jest @types/jest supertest @types/supertest @types/node`.
Scripts de `apps/api/package.json`: `build` (`nest build`), `start:dev` (`nest start --watch`), `test` (`jest`), `test:int` (`jest -c jest.integration.config.ts --runInBand`), `typecheck` (`tsc --noEmit`), `lint` (`eslint src test`).

- [ ] **Step 2: Escribir los tests que fallan** (`env.validation.spec.ts`; helpers del propio test: `k()` = `randomBytes(32).toString('base64')` y `validKeys()` = `{ APP_ENCRYPTION_KEY: k(), SESSION_SECRET: k(), MEDIA_SIGNING_SECRET: k() }`)

```ts
it('aplica valores por defecto', () => {
  const env = validateEnv({ DATABASE_URL: 'postgresql://u:p@localhost:5432/db', ...validKeys() });
  expect(env.HOST).toBe('127.0.0.1');
  expect(env.APP_PORT).toBe(3000);
  expect(env.META_GRAPH_VERSION).toBe('v26.0');
  expect(env.LINKEDIN_API_VERSION).toBe('202609');
  expect(env.MISSED_POST_GRACE_MINUTES).toBe(60);
});
it('falla si falta APP_ENCRYPTION_KEY', () => {
  expect(() => validateEnv({ DATABASE_URL: 'postgresql://x', SESSION_SECRET: k(), MEDIA_SIGNING_SECRET: k() }))
    .toThrow(/APP_ENCRYPTION_KEY/);
});
it.each([
  ['hex de 64 caracteres', 'a'.repeat(64)],
  ['31 bytes', randomBytes(31).toString('base64')],
  ['con espacios', ' ' + randomBytes(32).toString('base64')],
])('rechaza una clave mal formada (%s) sin filtrar su valor', (_, bad) => {
  let message = '';
  try { validateEnv({ DATABASE_URL: 'postgresql://x', ...validKeys(), APP_ENCRYPTION_KEY: bad }); }
  catch (e) { message = (e as Error).message; }
  expect(message).toMatch(/APP_ENCRYPTION_KEY/);
  expect(message).not.toContain(bad.trim());
});
it('convierte los puertos de string a number', () => {
  expect(validateEnv({ DATABASE_URL: 'postgresql://x', ...validKeys(), APP_PORT: '8080' }).APP_PORT).toBe(8080);
});
it('rechaza PUBLIC_BASE_URL que no sea https', () => {
  expect(() => validateEnv({ DATABASE_URL: 'postgresql://x', ...validKeys(), PUBLIC_BASE_URL: 'http://x.com' }))
    .toThrow(/PUBLIC_BASE_URL/);
});
```

- [ ] **Step 3: Ejecutar y confirmar que fallan**

Run: `npm test -w apps/api -- env.validation` → Expected: FAIL (`validateEnv` no existe).

- [ ] **Step 4: Implementar `env.validation.ts`**

`plainToInstance(EnvironmentVariables, raw, { enableImplicitConversion: true })` + `validateSync(…, { skipMissingProperties: false })`; los defaults son inicializadores de propiedad. `IsBase64Key(n)`: exige el regex base64 estricto (sin espacios) y que `Buffer.from(v, 'base64').length === n`. Para construir el mensaje se usan **solo** `error.property` y las claves de `error.constraints`; nunca `error.value`.

- [ ] **Step 5: Ejecutar los tests y confirmar que pasan**

Run: `npm test -w apps/api -- env.validation` → Expected: PASS (6 tests).

- [ ] **Step 6: `main.ts`, `AppModule` y `.env.example`**

`main.ts`: `NestFactory.create(AppModule, { bufferLogs: true })` → `configureApp(app)` (Task 4) → `app.listen(env.APP_PORT, env.HOST)`. `.env.example`: copia literal de `docs/design/02-arquitectura.md` §7, añadiendo `HOST=127.0.0.1` y `LOG_LEVEL=info`, con todos los secretos vacíos.

- [ ] **Step 7: Commit**

```bash
git add apps/api .env.example package.json package-lock.json
git commit -m "feat(api): scaffold NestJS app with validated environment"
```

---

### Task 3: Logs con redacción de secretos

**Files:**
- Create: `apps/api/src/common/logging/redaction.ts`, `apps/api/src/common/logging/logger.config.ts`
- Modify: `apps/api/src/app.module.ts` (importar `LoggerModule.forRootAsync`), `apps/api/src/main.ts` (`app.useLogger(app.get(Logger))`)
- Test: `apps/api/src/common/logging/redaction.spec.ts`, `apps/api/src/common/logging/logger.config.spec.ts`

**Interfaces:**
- Produces:
  - `const REDACT_PATHS: string[]` — como mínimo `req.headers.authorization`, `req.headers.cookie`, `res.headers["set-cookie"]`, `*.access_token`, `*.refresh_token`, `*.token`, `*.password`, `*.passwordHash`, `*.client_secret`, `*.apiKey`, `*.accessToken`, `*.refreshToken`.
  - `function sanitizeUrl(url: string): string` — sustituye por `[REDACTED]` el valor de los parámetros de query cuyo nombre case con `/token|secret|code|signature|password|key|state/i`. Las URLs relativas y las inválidas se procesan sin lanzar error.
  - `function sanitizeText(text: string): string` — redacta `access_token=…`, `refresh_token=…`, `client_secret=…`, `Bearer <x>` y `"access_token":"…"` dentro de texto libre.
  - `function buildLoggerParams(env: EnvironmentVariables): Params` (nestjs-pino): `level = env.LOG_LEVEL`, `redact: { paths: REDACT_PATHS, censor: '[REDACTED]' }`, serializador `req` que aplica `sanitizeUrl(req.url)`, serializador `err` que aplica `sanitizeText` a `message` y `stack`, `genReqId` = UUIDv7 (`uuid` v7) o la cabecera `x-request-id` entrante, y `pino-pretty` solo cuando `NODE_ENV === 'development'`.

- [ ] **Step 1: Escribir los tests que fallan**

```ts
// redaction.spec.ts
expect(sanitizeUrl('/oauth/cb?code=abc&state=xyz&ok=1')).toBe('/oauth/cb?code=%5BREDACTED%5D&state=%5BREDACTED%5D&ok=1');
expect(sanitizeUrl('https://graph.facebook.com/v26.0/me?access_token=EAAB123&fields=id'))
  .not.toContain('EAAB123');
expect(sanitizeUrl('not a url ::')).toBe('not a url ::');
expect(sanitizeText('request to https://graph.facebook.com/me?access_token=EAAB123 failed')).not.toContain('EAAB123');
expect(sanitizeText('Authorization: Bearer eyJhbGciOi.payload.sig')).not.toContain('eyJhbGciOi');
expect(sanitizeText('{"access_token":"IGQV123","token_type":"bearer"}')).not.toContain('IGQV123');

// logger.config.spec.ts — pino real escribiendo a un stream en memoria
it('redacta tokens en objetos y en errores', () => {
  const lines: string[] = [];
  const logger = pino({ ...buildLoggerParams(env).pinoHttp as LoggerOptions, transport: undefined },
                      { write: (l: string) => lines.push(l) });
  logger.info({ account: { access_token: 'EAAsecret', refreshToken: 'r1' } }, 'saved');
  logger.error({ err: new Error('GET https://graph.facebook.com/me?access_token=EAAsecret2 ECONNRESET') }, 'fail');
  const out = lines.join('\n');
  expect(out).not.toMatch(/EAAsecret|r1"|EAAsecret2/);
  expect(out).toContain('[REDACTED]');
});
```

- [ ] **Step 2: Ejecutar y confirmar que fallan**

Run: `npm test -w apps/api -- logging` → Expected: FAIL (módulos inexistentes).

- [ ] **Step 3: Implementar `redaction.ts` y `logger.config.ts`**

Dependencias: `nestjs-pino pino-http pino uuid`; de desarrollo: `pino-pretty`. `sanitizeUrl` usa `new URL(url, 'http://placeholder')` y reconstruye el resultado relativo si la entrada era relativa.

- [ ] **Step 4: Ejecutar los tests y confirmar que pasan**

Run: `npm test -w apps/api -- logging` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat(api): add pino logging with token and secret redaction"
```

---

### Task 4: Errores centralizados y configuración común de la app

**Files:**
- Create: `apps/api/src/common/errors/app-error.ts`, `apps/api/src/common/errors/all-exceptions.filter.ts`, `apps/api/src/app.setup.ts`
- Test: `apps/api/test/app.e2e-spec.ts` (con un `TestErrorsController` definido dentro del propio archivo de test)

**Interfaces:**
- Produces:
  - `type ErrorCode = 'VALIDATION_FAILED' | 'NOT_FOUND' | 'CONFLICT' | 'IN_USE' | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'INTERNAL'` (los sprints siguientes añaden códigos a esta unión).
  - `class AppError extends Error { constructor(code: ErrorCode, message: string, status: number, details?: Record<string, unknown>) }` con propiedades `readonly code`, `readonly status`, `readonly details`.
  - `interface ErrorBody { statusCode: number; code: string; message: string; details?: Record<string, unknown>; requestId: string }`.
  - `class AllExceptionsFilter implements ExceptionFilter` — mapeo:
    - `AppError` → su status, su code y su message.
    - `BadRequestException` del `ValidationPipe` → 400 `VALIDATION_FAILED`, `details.fields: Record<string, string[]>`.
    - `NotFoundException` / ruta inexistente → 404 `NOT_FOUND`.
    - Otras `HttpException` → su status, con un code derivado (401 `UNAUTHENTICATED`, 403 `FORBIDDEN`, 409 `CONFLICT`).
    - `Prisma.PrismaClientKnownRequestError`: `P2002` → 409 `CONFLICT`, `P2025` → 404 `NOT_FOUND`, `P2003` → 409 `IN_USE`. Se detecta por la propiedad `code` y el nombre de la clase, para no acoplar el filtro antes de la Task 6.
    - Cualquier otra cosa → 500 `INTERNAL`, `message: 'Error interno. Revisa los logs con el requestId.'`, y el error real va al logger (redactado).
    - `requestId` = `req.id` (lo asigna pino-http).
  - `function configureApp(app: INestApplication): void` — `setGlobalPrefix('api/v1', { exclude: ['healthz'] })`, `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, exceptionFactory })` que produce `details.fields`, `useGlobalFilters(new AllExceptionsFilter(logger))`, `helmet()`, `enableShutdownHooks()`. Se usa **igual** en `main.ts` y en los tests e2e.

- [ ] **Step 1: Escribir los tests e2e que fallan** (`TestErrorsController`: `GET /api/v1/__test/app-error`, `POST /api/v1/__test/dto` con un DTO `{ @IsString() name }`, `GET /api/v1/__test/boom` que hace `throw new Error('db password=hunter2')`)

```ts
it('formatea AppError', async () => {
  const res = await request(app.getHttpServer()).get('/api/v1/__test/app-error').expect(409);
  expect(res.body).toEqual({ statusCode: 409, code: 'IN_USE', message: 'en uso', details: { id: 'x' }, requestId: expect.any(String) });
});
it('valida DTOs con whitelist y forbidNonWhitelisted', async () => {
  const res = await request(app.getHttpServer()).post('/api/v1/__test/dto').send({ name: 1, extra: true }).expect(400);
  expect(res.body.code).toBe('VALIDATION_FAILED');
  expect(Object.keys(res.body.details.fields)).toEqual(expect.arrayContaining(['name', 'extra']));
});
it('ruta inexistente → 404 con el formato común', async () => {
  const res = await request(app.getHttpServer()).get('/api/v1/nada').expect(404);
  expect(res.body.code).toBe('NOT_FOUND');
});
it('un error desconocido no filtra detalles internos', async () => {
  const res = await request(app.getHttpServer()).get('/api/v1/__test/boom').expect(500);
  expect(res.body.code).toBe('INTERNAL');
  expect(JSON.stringify(res.body)).not.toContain('hunter2');
});
it('propaga x-request-id entrante', async () => {
  const res = await request(app.getHttpServer()).get('/api/v1/nada').set('x-request-id', 'abc-123');
  expect(res.body.requestId).toBe('abc-123');
});
```

- [ ] **Step 2: Ejecutar y confirmar que fallan**

Run: `npm test -w apps/api -- app.e2e` → Expected: FAIL.

- [ ] **Step 3: Implementar `app-error.ts`, `all-exceptions.filter.ts` y `app.setup.ts`; usar `configureApp` en `main.ts`**

- [ ] **Step 4: Ejecutar los tests y confirmar que pasan**

Run: `npm test -w apps/api -- app.e2e` → Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat(api): centralize error responses and global app setup"
```

---

### Task 5: Cifrado de tokens y tokens firmados

**Files:**
- Create: `apps/api/src/common/crypto/token-cipher.ts`, `apps/api/src/common/crypto/signed-token.ts`, `apps/api/src/common/crypto/crypto.module.ts`
- Modify: `apps/api/src/app.module.ts` (importar `CryptoModule`)
- Test: `apps/api/src/common/crypto/token-cipher.spec.ts`, `apps/api/src/common/crypto/signed-token.spec.ts`

**Interfaces:**
- Produces:
  - `class CryptoError extends Error` (mensaje genérico: nunca incluye texto plano ni la clave).
  - `class TokenCipher { constructor(keys: ReadonlyMap<number, Buffer>, currentVersion: number); encrypt(plaintext: string): { data: Buffer; keyVersion: number }; decrypt(data: Buffer, keyVersion: number): string }` — AES-256-GCM, IV aleatorio de 12 bytes, `data = iv ‖ authTag(16) ‖ ciphertext`. El constructor lanza un error si alguna clave no mide 32 bytes o si `currentVersion` no está en `keys`.
  - `function signToken(payload: Record<string, unknown> & { exp: number }, secret: Buffer): string` → `base64url(JSON) + '.' + base64url(HMAC-SHA256)`.
  - `function verifyToken<T extends Record<string, unknown>>(token: string, secret: Buffer, nowSeconds: number): (T & { exp: number }) | null` — `timingSafeEqual`; devuelve `null` si el token está mal formado, la firma no coincide o `exp <= nowSeconds`. Nunca lanza.
  - `CryptoModule` (`@Global`) provee `TokenCipher` (clave versión 1 = `APP_ENCRYPTION_KEY`) y el token de inyección `MEDIA_SIGNING_SECRET` (`Buffer`).

- [ ] **Step 1: Escribir los tests que fallan**

```ts
// token-cipher.spec.ts
const key = randomBytes(32);
const cipher = new TokenCipher(new Map([[1, key]]), 1);
it('roundtrip', () => { const { data, keyVersion } = cipher.encrypt('EAAB-token'); expect(cipher.decrypt(data, keyVersion)).toBe('EAAB-token'); });
it('layout iv‖tag‖ct', () => { expect(cipher.encrypt('abc').data.length).toBe(12 + 16 + 3); });
it('IV distinto en cada cifrado', () => { expect(cipher.encrypt('x').data.equals(cipher.encrypt('x').data)).toBe(false); });
it('detecta manipulación', () => { const { data } = cipher.encrypt('x'); data[data.length - 1] ^= 0xff; expect(() => cipher.decrypt(data, 1)).toThrow(CryptoError); });
it('falla con otra clave', () => { const other = new TokenCipher(new Map([[1, randomBytes(32)]]), 1); expect(() => other.decrypt(cipher.encrypt('x').data, 1)).toThrow(CryptoError); });
it('versión de clave desconocida', () => { expect(() => cipher.decrypt(cipher.encrypt('x').data, 2)).toThrow(CryptoError); });
it('rechaza claves que no son de 32 bytes', () => { expect(() => new TokenCipher(new Map([[1, randomBytes(16)]]), 1)).toThrow(); });
it('el error no contiene el texto plano', () => { try { cipher.decrypt(Buffer.alloc(40), 1); } catch (e) { expect(String(e)).not.toMatch(/EAAB/); } });

// signed-token.spec.ts
const secret = randomBytes(32); const now = 1_800_000_000;
it('verifica un token válido', () => { expect(verifyToken(signToken({ mediaId: 'm1', exp: now + 3600 }, secret), secret, now)).toEqual({ mediaId: 'm1', exp: now + 3600 }); });
it('expirado → null', () => { expect(verifyToken(signToken({ mediaId: 'm1', exp: now }, secret), secret, now)).toBeNull(); });
it('payload manipulado → null', () => { const [, s] = signToken({ mediaId: 'm1', exp: now + 10 }, secret).split('.'); const p = Buffer.from(JSON.stringify({ mediaId: 'm2', exp: now + 10 })).toString('base64url'); expect(verifyToken(`${p}.${s}`, secret, now)).toBeNull(); });
it('otro secreto → null', () => { expect(verifyToken(signToken({ mediaId: 'm1', exp: now + 10 }, secret), randomBytes(32), now)).toBeNull(); });
it.each(['', 'abc', 'a.b.c', '..', '%%%.%%%'])('malformado %p → null', (t) => { expect(verifyToken(t, secret, now)).toBeNull(); });
```

- [ ] **Step 2: Ejecutar y confirmar que fallan**

Run: `npm test -w apps/api -- crypto` → Expected: FAIL.

- [ ] **Step 3: Implementar con `node:crypto`** (`createCipheriv('aes-256-gcm', …)`, `createHmac('sha256', …)`, `timingSafeEqual` comparando primero las longitudes).

- [ ] **Step 4: Ejecutar los tests y confirmar que pasan**

Run: `npm test -w apps/api -- crypto` → Expected: PASS (13+ tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat(api): add AES-256-GCM token cipher and HMAC signed tokens"
```

---

### Task 6: Prisma — schema completo, migración inicial, salud de la BD

**Files:**
- Create: `apps/api/prisma.config.ts`, `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/<timestamp>_init/migration.sql`, `apps/api/src/prisma/prisma.service.ts`, `apps/api/src/prisma/prisma.module.ts`, `apps/api/src/health/health.controller.ts`, `apps/api/jest.integration.config.ts`, `apps/api/test/support/postgres.ts`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/test/db.int-spec.ts`, `apps/api/test/health.int-spec.ts`

**Interfaces:**
- Consumes: `configureApp` (Task 4).
- Produces:
  - `schema.prisma` = **copia literal** del bloque de `docs/design/03-modelo-datos.md` §3, con dos ajustes en el generator: `moduleFormat = "cjs"` (Nest compila a CommonJS) y `output = "../src/generated/prisma"`.
  - `class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy` — construida con `new PrismaPg({ connectionString: env.DATABASE_URL })`; `$connect` en `onModuleInit` y `$disconnect` en `onModuleDestroy`. `PrismaModule` es `@Global`.
  - `HealthController` `@Get('healthz')` → `200 { ok: true }` si `SELECT 1` responde en menos de 2 s; si no, `503 { ok: false }`. Sin detalles del error en la respuesta.
  - `startTestDatabase(): Promise<{ url: string; stop(): Promise<void> }>` — `new PostgreSqlContainer('postgres:17-alpine').start()`; ejecuta `npx prisma migrate deploy` con `DATABASE_URL` = la URI del contenedor.
  - Scripts de `apps/api`: `prisma:generate`, `prisma:migrate:dev`, `prisma:migrate:deploy`; `postinstall` ejecuta `prisma generate`.

- [ ] **Step 1: Escribir el schema y generar la migración vacía**

Run (con el Postgres de desarrollo levantado: `docker run -d --name sh-dev-db -e POSTGRES_PASSWORD=dev -p 127.0.0.1:5432:5432 postgres:17-alpine`): `npx prisma migrate dev --create-only --name init -w apps/api`
Expected: se crea `prisma/migrations/<ts>_init/migration.sql`.

- [ ] **Step 2: Añadir al final de `migration.sql` el SQL adicional**

Copia literal de `docs/design/03-modelo-datos.md`: el bloque "SQL adicional en la migración inicial" (CHECKs, `post_targets_due_idx`, `notifications_unread_idx`) **más** el `CREATE VIEW account_daily_stats` de §5. Comprobar después que `npx prisma migrate dev` no detecta drift (Prisma no gestiona vistas sin la preview feature `views`). Si la detectara, mover la vista a una segunda migración `<ts>_stats_view` creada con `--create-only`.

- [ ] **Step 3: Escribir los tests de integración que fallan** (`db.int-spec.ts`; `beforeAll` levanta `startTestDatabase()` y crea un `PrismaClient` con el adapter; `afterAll` llama a `stop()`)

```ts
it('solo permite un usuario', async () => {
  await prisma.user.create({ data: { username: 'a', passwordHash: 'h' } });
  await expect(prisma.$executeRaw`INSERT INTO users (id, singleton, username, password_hash, updated_at)
    VALUES (gen_random_uuid(), false, 'b', 'h', now())`).rejects.toThrow(/users_singleton/);
  await expect(prisma.user.create({ data: { username: 'c', passwordHash: 'h' } })).rejects.toMatchObject({ code: 'P2002' });
});
it('un target SCHEDULED exige scheduled_at', async () => {
  const { account, post } = await seedAccountAndPost(prisma);   // helper local del test
  await expect(prisma.postTarget.create({ data: { postId: post.id, accountId: account.id, format: 'FEED', status: 'SCHEDULED' } }))
    .rejects.toThrow(/scheduled_needs_date/);
});
it('un snapshot por cuenta y día', async () => {
  const { account } = await seedAccountAndPost(prisma);
  const row = { accountId: account.id, network: 'INSTAGRAM' as const, snapshotDate: new Date('2026-10-01'), source: 'CRON' as const, metrics: {}, catalogVersion: 1, apiVersion: 'v26.0' };
  await prisma.accountSnapshot.create({ data: row });
  await expect(prisma.accountSnapshot.create({ data: row })).rejects.toMatchObject({ code: 'P2002' });
});
it('metrics debe ser un objeto JSON', async () => {
  const { account } = await seedAccountAndPost(prisma);
  await expect(prisma.$executeRaw`INSERT INTO account_snapshots (account_id, network, snapshot_date, source, metrics, catalog_version, api_version)
    VALUES (${account.id}, 'INSTAGRAM', '2026-10-02', 'CRON', '[1,2]'::jsonb, 1, 'v26.0')`).rejects.toThrow(/metrics_is_object/);
});
it('account_daily_stats calcula el neto y detecta huecos', async () => {
  const { account } = await seedAccountAndPost(prisma);
  for (const [d, f] of [['2026-10-01', 100], ['2026-10-02', 104], ['2026-10-05', 101]] as const)
    await prisma.accountSnapshot.create({ data: { accountId: account.id, network: 'INSTAGRAM', snapshotDate: new Date(d), source: 'CRON', metrics: { followers_count: f }, catalogVersion: 1, apiVersion: 'v26.0' } });
  const rows = await prisma.$queryRaw<Array<{ net_followers: number | null; days_since_prev: number | null }>>`
    SELECT net_followers, days_since_prev FROM account_daily_stats WHERE account_id = ${account.id} ORDER BY snapshot_date`;
  expect(rows).toEqual([
    { net_followers: null, days_since_prev: null },
    { net_followers: 4, days_since_prev: 1 },
    { net_followers: -3, days_since_prev: 3 },
  ]);
});
it('no se puede borrar un medio en uso', async () => { /* crea media + target + post_target_media; delete media → P2003 */ });
```

Y en `health.int-spec.ts`: `GET /healthz` → 200 `{ ok: true }` con la BD arriba; tras `await container.stop()` → 503 `{ ok: false }`.

- [ ] **Step 4: Ejecutar y confirmar que fallan**

Run: `npm run test:int -w apps/api` → Expected: FAIL (`PrismaService`/`HealthController` no existen; con la migración ya creada, los tests de BD pueden pasar o fallar según el orden: lo que importa es que `health.int-spec` falla).

- [ ] **Step 5: Implementar `PrismaService`, `PrismaModule` y `HealthController`; registrarlos en `AppModule`**

- [ ] **Step 6: Ejecutar los tests y confirmar que pasan**

Run: `npm run test:int -w apps/api` → Expected: PASS (todos). Run: `npm test -w apps/api` → Expected: PASS (los unitarios siguen en verde).

- [ ] **Step 7: Commit**

```bash
git add apps/api
git commit -m "feat(api): add Prisma schema, initial migration and DB health check"
```

---

### Task 7: `npm run setup` (genera `.env` de forma segura)

**Files:**
- Create: `scripts/setup-lib.mjs`, `scripts/setup.mjs`
- Modify: `package.json` (script `"setup": "node scripts/setup.mjs"`)
- Test: `scripts/setup-lib.test.mjs` (`node --test`; script raíz `test:scripts`, incluido en `npm test`)

**Interfaces:**
- Produces:
  - `export function buildEnvFile(exampleText: string, existingText: string | null, randomBytes: (n: number) => Buffer): { content: string; generated: string[] }`
    - Parte de las líneas de `.env.example` (conserva comentarios y orden).
    - Si una clave tiene valor **no vacío** en `existingText`, lo conserva **siempre**.
    - Rellena las claves vacías `APP_ENCRYPTION_KEY`, `SESSION_SECRET` y `MEDIA_SIGNING_SECRET` con `randomBytes(32).toString('base64')`, y `POSTGRES_PASSWORD` con `randomBytes(24).toString('base64url')`.
    - Si `DATABASE_URL` está vacía, la construye: `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:${DB_PORT ?? 5432}/${POSTGRES_DB}`.
    - Las claves que existan en `existingText` pero no en el ejemplo se conservan al final, bajo el comentario `# ── Variables propias ──`.
    - `generated` lista **solo los nombres** de las claves generadas.
  - `setup.mjs`: lee `.env.example` y `.env` (si existe), escribe `.env` y muestra `Generadas: X, Y` o `.env ya estaba completo; no se cambió nada`. Nunca imprime valores. Crea `data/media/` si no existe.

- [ ] **Step 1: Escribir los tests que fallan**

```js
const EX = 'POSTGRES_USER=socialhub\nPOSTGRES_PASSWORD=\nPOSTGRES_DB=socialhub\nDATABASE_URL=\n# seguridad\nAPP_ENCRYPTION_KEY=\nSESSION_SECRET=\nMEDIA_SIGNING_SECRET=\nTZ=UTC\n';
const rnd = (n) => Buffer.alloc(n, 7);
test('primera ejecución rellena secretos y DATABASE_URL', () => {
  const { content, generated } = buildEnvFile(EX, null, rnd);
  assert.match(content, /^APP_ENCRYPTION_KEY=.{44}$/m);
  assert.equal(Buffer.from(content.match(/^APP_ENCRYPTION_KEY=(.*)$/m)[1], 'base64').length, 32);
  assert.match(content, /^DATABASE_URL=postgresql:\/\/socialhub:[A-Za-z0-9_-]+@127\.0\.0\.1:5432\/socialhub$/m);
  assert.deepEqual(generated.sort(), ['APP_ENCRYPTION_KEY','DATABASE_URL','MEDIA_SIGNING_SECRET','POSTGRES_PASSWORD','SESSION_SECRET']);
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
```

- [ ] **Step 2: Ejecutar y confirmar que fallan**

Run: `node --test scripts/` → Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implementar `setup-lib.mjs` y `setup.mjs`**

- [ ] **Step 4: Ejecutar los tests y confirmar que pasan**

Run: `node --test scripts/` → Expected: PASS (4 tests).

- [ ] **Step 5: Probar el CLI de verdad dos veces**

Run: `npm run setup` → Expected: `Generadas: POSTGRES_PASSWORD, DATABASE_URL, APP_ENCRYPTION_KEY, SESSION_SECRET, MEDIA_SIGNING_SECRET`.
Run: `npm run setup` → Expected: `.env ya estaba completo; no se cambió nada`.
Run: `git status --porcelain .env` → Expected: sin salida (`.env` está ignorado).

- [ ] **Step 6: Commit**

```bash
git add scripts package.json
git commit -m "feat: add idempotent setup script that generates .env secrets"
```

---

### Task 8: Docker (imagen + compose) y README de arranque

**Files:**
- Create: `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `README.md`

**Interfaces:**
- Consumes: `prisma:migrate:deploy` y `build` (Tasks 2 y 6), `/healthz` (Task 6).
- Produces: imagen que, al arrancar, ejecuta las migraciones y luego la app con `HOST=0.0.0.0`.

- [ ] **Step 1: Escribir el `Dockerfile` multi-stage**
  - `deps`: `node:24-alpine`, `npm ci` con solo los `package*.json` de la raíz y de `apps/api` (caché de capas).
  - `build`: copia el código y ejecuta `npm run prisma:generate -w apps/api && npm run build -w apps/api`.
  - `runtime`: `node:24-alpine`, `NODE_ENV=production`, `HOST=0.0.0.0`; copia `dist`, `node_modules` (tras `npm prune --omit=dev`; el CLI `prisma` debe estar en `dependencies` para que `migrate deploy` funcione), `prisma/` y `prisma.config.ts`; `USER node`; `EXPOSE 3000`; `HEALTHCHECK` con `node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"`.
  - `CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]` (forma exec, sin un `.sh` aparte).

- [ ] **Step 2: Escribir `docker-compose.yml`**

Es el borrador de `docs/design/02-arquitectura.md` §6, **sin** el servicio `tunnel` (llega en el sprint 5). Además, el servicio `app` define `HOST: 0.0.0.0`. `.dockerignore`: `node_modules`, `**/dist`, `.env`, `data`, `.git`, `coverage`, `spikes`.

- [ ] **Step 3: Escribir el `README.md` mínimo**

Qué es SocialHub (2 líneas), estado ("en construcción, sprint 0"), requisitos (Docker Desktop o Node 24 + PostgreSQL 17), inicio rápido (`git clone https://github.com/Ezy01v1/GestorRedes.git && cd GestorRedes`, `npm run setup`, `docker compose up -d`, abrir `http://127.0.0.1:3000/healthz`), modo desarrollo, enlace a `docs/design/` y licencia MIT.

- [ ] **Step 4: Verificar de punta a punta**

Run: `docker compose up -d --build` y después `docker compose ps` → Expected: `db` y `app` en estado `healthy`.
Run: `curl -s http://127.0.0.1:3000/healthz` → Expected: `{"ok":true}`.
Run: `docker compose logs app | grep -Ei "access_token|APP_ENCRYPTION_KEY=|password="` → Expected: sin coincidencias.
Run: `git ls-files --eol Dockerfile docker-compose.yml package.json` → Expected: `i/lf` en todos.
Run: `docker compose down` → Expected: limpio. Con `docker compose up -d` de nuevo → los datos persisten (volumen `pgdata`) y `/healthz` sigue en `{"ok":true}`.

- [ ] **Step 5: Commit**

```bash
git add Dockerfile docker-compose.yml .dockerignore README.md
git commit -m "feat: add Docker image, compose stack and quickstart README"
```

---

### Task 9: CI en GitHub Actions + primer push

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Escribir el workflow**

Se dispara en `push` a `main` y en `pull_request`. Un job `ci` en `ubuntu-latest`: `actions/checkout@v4`, `actions/setup-node@v4` (`node-version-file: .nvmrc`, `cache: npm`), `npm ci`, `npm run lint`, `npm run typecheck`, `npm test` (unitarios + `node --test scripts/`), `npm run test:int` (Testcontainers usa el Docker del runner) y `docker build .`. Job `commitlint` solo en PRs (`wagoid/commitlint-github-action@v6`). `permissions: contents: read`.

- [ ] **Step 2: Verificar localmente lo mismo que CI**

Run: `npm ci && npm run lint && npm run typecheck && npm test && npm run test:int && docker build .` → Expected: todo termina con código 0.

- [ ] **Step 3: Commit y push (con confirmación previa del usuario)**

```bash
git add .github
git commit -m "ci: add lint, typecheck, unit, integration and docker build checks"
git push -u origin main
```
Expected: el workflow `CI` aparece en verde en `https://github.com/Ezy01v1/GestorRedes/actions`.

---

### Task 10: Spike de riesgos de Meta (código desechable + informe)

**Requiere a la persona dueña de las cuentas**; no se puede automatizar. Pasos previos (los hace el usuario):
1. Crear una app de Meta tipo *Business* con los casos de uso de Instagram (Instagram Login) y de páginas.
2. Añadir su cuenta de IG Business/Creator como **Instagram Tester** y aceptar la invitación.
3. Generar un token de usuario de Instagram desde el panel de la app.
4. Pedir a **otra persona sin rol en la app** que envíe un DM y comente un post.

**Files (rama `spike/meta-risks`, nunca se fusiona):**
- Create: `spikes/meta/check-inbox.mjs`, `spikes/meta/publish-story-via-tunnel.mjs`, `spikes/meta/check-metrics.mjs`, `spikes/meta/README.md`
**Files (sí van a `main`):**
- Create: `docs/design/spike-results.md`
- Modify: `docs/design/01-viabilidad-apis.md`, `docs/design/03-modelo-datos.md` (sustituir cada 🔍 por ✅/❌ y su nombre definitivo)

Todos los scripts leen el token de `SPIKE_IG_TOKEN` / `SPIKE_PAGE_TOKEN` (variables de entorno, nunca en archivos) y solo imprimen nombres de campos, conteos y códigos de error, nunca el token ni datos personales.

- [ ] **Step 1: `check-inbox.mjs`.** Llama a `GET https://graph.instagram.com/v26.0/me/conversations?platform=instagram&fields=participants,messages{from,created_time}` y a `GET /me/media?fields=id,comments_count,comments{from,text}`. Imprime: nº de conversaciones, si alguna incluye al usuario **sin rol** (comparando con el username que se pasa como argumento), y nº de comentarios de ese usuario.

- [ ] **Step 2: `publish-story-via-tunnel.mjs`.** Levanta un `http.createServer` en `:3001` que sirve un JPEG de prueba en `/public-media/<token-aleatorio>`. El usuario ejecuta `cloudflared tunnel --url http://localhost:3001` y pasa la URL al script. El script crea un contenedor con `media_type=STORIES` e `image_url`, consulta `status_code` hasta `FINISHED` y publica. Se usa **Story** porque desaparece a las 24 h: la API no permite borrar posts de IG.

- [ ] **Step 3: `check-metrics.mjs`.** Pide una por una cada métrica marcada con 🔍 (IG: `profile_views`, `follows_and_unfollows`, `follower_count`, `online_followers`; FB: `page_views_total`, `page_daily_follows_unique`, `page_daily_unfollows_unique`, `page_follows`, `page_media_view`, `page_total_media_view_unique`) y registra si responde con datos o con error, junto con el código.

- [ ] **Step 4: Ejecutar con el usuario y escribir `docs/design/spike-results.md`**

Por cada pregunta: resultado, evidencia (código de error o conteo) y la decisión que implica, por ejemplo: "DMs de usuarios sin rol: no llegan → la bandeja de DMs se marca *requiere Advanced Access*".

- [ ] **Step 5: Actualizar los documentos de diseño y hacer commit en `main`**

```bash
git add docs/design
git commit -m "docs: record Meta API spike results and resolve open metric questions"
```

---

## Criterio de terminado del sprint 0

- [ ] `npm run setup && docker compose up -d` en una máquina limpia → `{"ok":true}` en `http://127.0.0.1:3000/healthz`.
- [ ] CI en verde en `main`.
- [ ] `docs/design/spike-results.md` existe y ya no queda ningún 🔍 en los pasos 1 y 3.
