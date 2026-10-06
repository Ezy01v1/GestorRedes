# Paso 5 — Plan del MVP por sprints (un solo desarrollador)

> Estado: borrador para revisión · Fecha: 2026-10-05
> Depende de: pasos [1](./01-viabilidad-apis.md) · [2](./02-arquitectura.md) · [3](./03-modelo-datos.md) · [4](./04-api-rest.md)

---

## 1. Supuestos

- **Sprint = 1 semana a tiempo completo** (unas 30–35 h efectivas). A medio tiempo, cada sprint dura dos semanas.
- **MVP = v0.1.0:** Instagram + Facebook Pages + LinkedIn (perfil). Incluye calendario, publicación, biblioteca de medios, estadísticas con snapshots, bandeja de comentarios, notificaciones e IA opcional.
- Cada sprint termina en algo **que funciona de punta a punta** y se integra en `main` mediante un PR propio (aunque trabajes solo: el PR deja historial y CI).

## 2. Decisión clave de orden: **los snapshots van antes que la publicación**

La mayoría de las APIs no dan historial de seguidores: solo lo acumulamos **desde el día en que empieza el cron**. Por eso el sprint 3 deja la recolección diaria funcionando aunque todavía no exista el dashboard. Cuando lleguemos al sprint 6 ya habrá **unas 3 semanas de datos reales** para construir y probar las gráficas.

---

## 3. Sprints

### Sprint 0 — Fundaciones + spike de riesgos
**Objetivo:** el repo arranca con `npm run setup && docker compose up`, CI en verde, y los riesgos de la API despejados.
- Monorepo npm workspaces (`apps/api`, `apps/web`, `packages/shared`), TypeScript estricto, ESLint + Prettier.
- Commits convencionales: `commitlint` + `husky`. Licencia MIT, `.gitignore`, `.env.example`, `.dockerignore`.
- `scripts/setup.mjs` (genera `.env` con claves aleatorias). `Dockerfile` multi-stage, `docker-compose.yml` con perfil `tunnel`.
- NestJS base: `ConfigModule` con validación de entorno, `nestjs-pino` con redacción, `AllExceptionsFilter`, `/healthz`.
- Prisma 7: schema completo del paso 3 + migración inicial con el SQL extra (CHECKs, índices parciales y la vista `account_daily_stats`).
- `CryptoModule`: AES-256-GCM y URLs firmadas HMAC (**TDD**).
- GitHub Actions: lint, typecheck, tests (con servicio Postgres) y build de la imagen.
- **Spike (código desechable, en `spikes/` y fuera de `main`):**
  1. ¿Llegan los DMs y comentarios de un seguidor **sin rol** en modo desarrollo?
  2. Publicar una imagen en IG servida desde un quick tunnel con URL firmada.
  3. Confirmar en v26.0 los nombres de las métricas marcadas con 🔍.
- **DoD:** contenedor sano en `127.0.0.1:3000/healthz`; el informe del spike está en `docs/design/spike-results.md` y los pasos 1–4 actualizados con lo aprendido.

### Sprint 1 — Acceso local + esqueleto del frontend
**Objetivo:** primer arranque → crear contraseña → login → app vacía con navegación.
- `AuthModule`: setup inicial, login, logout, sesiones en BD, argon2id, throttler, `SessionGuard` global, `@Public()`. CLI `npm run reset-password`.
- `NotificationsModule` + `GET /events` (SSE) + eventos de dominio (`@nestjs/event-emitter`).
- Web: Vite + React + Tailwind v4 + shadcn/ui, layout (barra lateral: Calendario, Bandeja, Estadísticas, Medios, Conexiones, Ajustes), rutas protegidas, pantallas de setup y login, campana de notificaciones con SSE.
- Generación de tipos desde OpenAPI (`npm run api:types`).
- **Sistema de diseño**: tokens de color (claro/oscuro), tipografía, espaciado, componentes base. *Aquí usamos las skills de diseño.*
- **DoD:** tests e2e de auth (supertest) y de componentes de login; Lighthouse de accesibilidad ≥ 90 en login.

### Sprint 2 — Conexión de cuentas
**Objetivo:** conectar IG, FB y LinkedIn desde la UI con tokens cifrados y renovación automática.
- `HttpClientModule`: backoff con *full jitter*, `Retry-After`, lectura de las cabeceras de uso de Meta, clasificación de errores y redacción (**TDD con nock**).
- `ProvidersModule`: interfaz, registro, `capabilities()`. Esqueleto de los adaptadores `instagram`, `facebook` y `linkedin`.
- OAuth: Facebook Login (páginas), Instagram Login, LinkedIn OIDC + Share; `state` + PKCE, callback, upsert de cuentas.
- Cron `token-refresh` + avisos de caducidad (LinkedIn a 7 días) + estado `NEEDS_RECONNECT`.
- UI de Conexiones: tarjetas por red ("no configurada → ver guía", "conectar", estado, caducidad, desactivar, desconectar).
- **Docs:** `docs/setup-meta.md` y `docs/setup-linkedin.md` paso a paso (crear la app, roles/testers, redirect URIs, scopes).
- **DoD:** conectar las tres redes con cuentas reales; test e2e del callback con el proveedor simulado; ningún token en los logs (test que busca patrones de token en la salida del logger).

### Sprint 3 — Recolección de estadísticas (snapshots)
**Objetivo:** desde este sprint, cada día se guardan las métricas de todas las cuentas.
- Catálogo de métricas canónicas versionado (`packages/shared`).
- Adaptadores IG y FB: `fetchAccountMetrics`, `fetchPosts`, `fetchPostMetrics`, `backfillAccountMetrics` (IG, 30 días). LinkedIn perfil: sin métricas (capacidad vacía).
- Crons `daily-snapshot` y `stories-metrics`; recuperación al arrancar; política de retención; `POST /stats/sync` + progreso por SSE; `GET /stats/availability`.
- Página provisional de Estadísticas: tabla con el último snapshot por cuenta y el botón "Sincronizar ahora".
- **DoD:** tests de mapeo API → claves canónicas con *fixtures* reales saneadas; test de integración del upsert diario y del backfill (Testcontainers).

### Sprint 4 — Medios, compositor y calendario
**Objetivo:** crear, editar, programar y reprogramar posts adaptados por red (todavía sin publicar).
- `MediaModule`: subida multipart, sha256, miniaturas y JPEG con sharp, metadatos de video (ffprobe vía `@ffprobe-installer`), servicio privado con `Range`.
- `packages/shared`: reglas por red (caracteres, hashtags, formatos, proporciones, duración).
- `PostsModule`: CRUD, variantes, `validate` (dry-run), schedule/reschedule/unschedule, duplicar, soft delete/restore, hashtag sets.
- Web: biblioteca de medios (arrastrar archivos, etiquetas, alt text); **compositor** (texto base → pestañas por red con contador de caracteres, vista previa, validación en vivo, primer comentario en IG); **calendario** FullCalendar mes/semana/lista con arrastrar y soltar, y bandeja de borradores.
- **DoD:** tests unitarios de las reglas por red (casos límite de longitud y hashtags); tests e2e del ciclo borrador → programado → reprogramado → cancelado.

### Sprint 5 — Motor de publicación  🎯 *primer hito utilizable*
**Objetivo:** lo programado se publica solo en IG, FB y LinkedIn.
- `PublishingModule`: cron `publish-due`, máquina de estados con `UPDATE` condicional, `publish_attempts`, conciliación antes de reintentar, recuperación al arrancar (`MISSED` / `NEEDS_REVIEW`), publicar ya, reintentar y resolver.
- `TunnelModule` + `PublicGatewayModule` (`:3001`, `/public-media/:token`).
- Adaptadores:
  - **FB**: texto, enlace, foto, video.
  - **LinkedIn**: texto, imagen, video, documento.
  - **IG**: feed, carrusel, Reel, Story (contenedor → polling de estado → publicar → primer comentario).
- Al publicar se crea el `social_post` vinculado (entra en las estadísticas).
- **DoD:** tests de la máquina de estados (todas las transiciones, incluido "el proceso muere en `PUBLISHING`"); tests de adaptadores con nock; prueba manual real en las 3 redes documentada.

### Sprint 6 — Dashboard de estadísticas
**Objetivo:** el módulo de estadísticas completo, con ~3 semanas de datos reales.
- Consultas tipadas (TypedSQL): overview con comparativa de periodos, timeseries (día/semana/mes con `generate_series`), seguidores ganados/perdidos, comparativa entre redes, ranking, mejores horarios (7×24 con tamaño de muestra).
- Web: tarjetas KPI con variación, gráficas de líneas y barras (Recharts), selector de rango y "comparar con el periodo anterior", filtros por red/cuenta, mapa de calor de horarios, ranking con miniaturas y marcas de discontinuidad del catálogo.
- Export CSV (streaming, BOM) + ruta imprimible `/reports/print` para PDF.
- **DoD:** tests de integración de cada consulta con datos sembrados (incluidos huecos de días y cambio de `catalog_version`); prueba visual en claro/oscuro.

### Sprint 7 — Bandeja unificada
**Objetivo:** comentarios de IG y FB en un solo lugar (+ DMs según el resultado del spike).
- `InboxModule`: cron `inbox-poll` con cursores y deduplicación, hilos y mensajes, responder, ocultar, borrar, leído/resuelto, contador de no leídos, `POST /inbox/sync`.
- DMs de IG y Messenger: **si el spike confirma la restricción**, se implementan igualmente (funcionan con usuarios con rol y con quien obtenga Advanced Access) y el README lo explica; en la UI aparecen como "requiere App Review".
- Web: bandeja de tres paneles (lista · hilo · contexto del post), filtros, atajos de teclado, notificaciones de nuevos comentarios.
- **DoD:** tests de deduplicación y paginación por cursor; e2e de responder a un comentario (proveedor simulado).

### Sprint 8 — IA opcional, pulido y release v0.1.0
- `AiModule`: guardar la API key de Anthropic cifrada, `POST /ai/suggest` (variantes por red y hashtags dentro de los límites de cada red) y botón "Sugerir" en el compositor.
- README final: requisitos, instalación (Docker y sin Docker), conexión de cuentas, limitaciones honestas por red, **solución de problemas** (`docs/troubleshooting.md`) y capturas.
- Revisión de seguridad (`/security-review`), accesibilidad, `CONTRIBUTING.md`, plantillas de issues, `CHANGELOG.md`, tag `v0.1.0` e imagen publicada en GHCR (opcional).
- **DoD:** instalación desde cero en una máquina limpia (Windows y Linux) siguiendo **solo** el README.

**Total MVP: ~9 semanas a tiempo completo (~18 a medio tiempo).**

---

## 4. Después del MVP

| Versión | Contenido | Estimación |
|---|---|---|
| v0.2 | **WhatsApp Cloud API**: webhook por túnel, bandeja de WhatsApp, plantillas (crear, consultar estado, enviar), ventana de 24 h, analítica de mensajes y costos, aviso de método de pago | 2 sprints |
| v0.3 | **LinkedIn Community Management** (opcional): Company Pages, comentarios, estadísticas del perfil y de la página | 1 sprint |
| v0.4 | **Threads** (reutiliza la infraestructura de Meta y el túnel) | 1 sprint |
| v0.5 | **YouTube** (Analytics con historial nativo + subida como privado) | 1–1,5 sprints |
| v0.6 | **X** (opcional, de pago por uso) | 1 sprint |

---

## 5. Estrategia de pruebas (transversal)

| Capa | Herramienta | Qué se prueba | Cuándo TDD |
|---|---|---|---|
| Lógica de dominio pura | Jest | cifrado, firmas, máquina de estados, reglas por red, mapeo de métricas, backoff | **Siempre TDD** |
| Adaptadores | Jest + nock + *fixtures* reales saneadas | traducción de respuestas, errores, paginación, rate limits | TDD sobre la fixture |
| Persistencia y consultas | Jest + Testcontainers (Postgres 17) | upserts de snapshots, vista, consultas de estadísticas, constraints | tests de integración |
| API | supertest (e2e) | auth, validación de DTOs, formato de error, flujos completos | por endpoint |
| Frontend | Vitest + Testing Library | compositor (validación en vivo), calendario, formularios | componentes críticos |
| Manual | checklist en el PR | publicación real en cada red | sprints 2, 5 y 7 |

Las **fixtures** se guardan sin datos personales ni tokens (script `scripts/sanitize-fixture.mjs`).

## 6. Flujo de Git

- `main` siempre desplegable; una rama por sprint o funcionalidad (`feat/auth`, `feat/publishing`…); PR con CI obligatorio.
- Commits convencionales (`feat:`, `fix:`, `docs:`, `test:`, `chore:`, `refactor:`), validados con commitlint.
- SemVer: `v0.x` hasta que la API del adaptador se estabilice.

## 7. Riesgos del plan

| Riesgo | Mitigación |
|---|---|
| El spike confirma que los DMs requieren App Review | Ya contemplado: la bandeja de comentarios sigue siendo el núcleo y los DMs quedan documentados como "requiere Advanced Access" |
| Meta cambia o depreca métricas durante el desarrollo | Catálogo versionado + `raw` guardado 90 días para remapear |
| La publicación de video en IG es lenta o inestable | Polling del contenedor con timeout y estado visible en la UI; los videos se pueden reintentar sin duplicar |
| Agotamiento (una sola persona) | Cada sprint entrega valor por sí solo; los sprints 7–8 pueden reordenarse según lo que más uses |
