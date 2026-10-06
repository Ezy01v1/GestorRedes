# SocialHub — Especificación de diseño

> Fecha: 2026-10-05 · Estado: **pendiente de revisión final** · Licencia del proyecto: MIT
> Esta especificación es el índice normativo. El detalle de cada área está en los documentos enlazados, que **forman parte de la especificación**.

| # | Documento | Contenido |
|---|---|---|
| 1 | [Viabilidad de APIs](../../design/01-viabilidad-apis.md) | Permisos, modo desarrollo, límites, métricas por red, evaluación de la fase 3 |
| 2 | [Arquitectura](../../design/02-arquitectura.md) | Diagrama, decisiones técnicas, carpetas, docker-compose, `.env`, crons, seguridad |
| 3 | [Modelo de datos](../../design/03-modelo-datos.md) | Schema Prisma, SQL extra, catálogo de métricas, snapshots, consultas |
| 4 | [API REST](../../design/04-api-rest.md) | Módulos NestJS, contrato de adaptadores, endpoints, errores, reintentos |
| 5 | [Plan MVP](../../design/05-plan-mvp.md) | Sprints 0–8, roadmap posterior, estrategia de pruebas, flujo de Git |

---

## 1. Intención (acordada)

**Qué es:** una aplicación **local** para gestionar las redes sociales propias desde un solo lugar (calendario, publicación multired, biblioteca de medios, bandeja de comentarios y mensajes, notificaciones y estadísticas históricas) con IA opcional.

**Para quién:** su autor y cualquier persona que clone el repositorio open source. Cada instalación tiene **un único dueño**, con sus propias apps y credenciales de Meta y LinkedIn. No hay SaaS, ni multi-tenant, ni tokens centralizados.

**Criterios de éxito:**
1. Instalación con `git clone` → `npm run setup` → `docker compose up -d` → crear contraseña en `http://127.0.0.1:3000`.
2. Programar un post adaptado a IG, FB y LinkedIn, y que se publique solo a la hora indicada.
3. Ver el crecimiento histórico de seguidores y el rendimiento, construido con snapshots diarios propios.
4. Responder comentarios de IG y FB desde una bandeja unificada.
5. Ningún token en texto plano en la BD, en los logs ni en Git.
6. Un README con el que una persona sin contexto puede crear sus apps, conectar sus cuentas y resolver los problemas habituales.

**Fuera de alcance:** multiusuario, facturación, panel de superadmin, scraping o cualquier automatización no oficial, apps móviles.

## 2. Decisiones aprobadas

| Área | Decisión | Paso |
|---|---|---|
| Instagram | *Instagram API with Instagram Login* (sin Página de FB obligatoria); token de 60 días renovado automáticamente | 1 |
| LinkedIn MVP | Solo publicar en el perfil personal (OIDC + Share on LinkedIn). La Community Management API (Company Pages y estadísticas) es un módulo opcional posterior | 1 |
| Riesgos de Meta | Spike en el sprint 0: DMs de usuarios sin rol, publicación en IG por túnel, nombres de métricas en v26.0 | 1 |
| Fase 3 | Prioridad: Threads → YouTube → X (opcional, de pago). Pinterest y GBP con baja prioridad. TikTok no recomendado | 1 |
| Proceso | Un solo proceso NestJS (API + SSE + React estático) con `@nestjs/schedule`; sin Redis | 2 |
| Exposición | UI en `127.0.0.1:3000`; listener público `:3001` solo con medios firmados y webhooks; túnel cloudflared opcional | 2 |
| Base de datos | **Solo PostgreSQL 17** (sin SQLite) | 2 |
| ORM | Prisma 7 + `@prisma/adapter-pg`; TypedSQL para estadísticas | 2 |
| Monorepo | npm workspaces: `apps/api`, `apps/web`, `packages/shared` | 2 |
| Frontend | React + Vite + TS + Tailwind v4 + shadcn/ui + TanStack Query + Recharts + FullCalendar | 2 |
| Seguridad | AES-256-GCM (tokens), argon2id (contraseña), sesiones en BD con cookie `httpOnly SameSite=Strict`, pino con redacción | 2 |
| Datos | `posts` (maestro) + `post_targets` (variante y estado por cuenta); `social_posts` (todo lo publicado); snapshots diarios en JSONB con claves canónicas y `catalog_version` | 3 |
| Retención | Snapshots de cuenta para siempre; snapshots de post diarios 30 días → semanales hasta 180 días → congelados; `raw` 90 días | 3 |
| API | REST `/api/v1`, errores con formato único, paginación por cursor, eventos de dominio → notificaciones por SSE | 4 |
| Publicación | Máquina de estados atómica; **conciliar antes de reintentar**; `NEEDS_REVIEW` si el proceso muere durante una publicación | 4 |
| PDF | Generado en el navegador (ruta imprimible), sin Puppeteer | 4 |
| Orden de trabajo | Snapshots (sprint 3) antes que publicación (sprint 5), para acumular historial | 5 |

## 3. Reglas transversales (no negociables)

1. Solo APIs oficiales.
2. Tokens cifrados en reposo, descifrados solo en memoria durante una llamada, nunca enviados al frontend ni escritos en logs.
3. `.env` nunca se versiona; `.env.example` sin valores secretos.
4. Variables de entorno validadas al arrancar: la app no arranca si falta alguna obligatoria o es inválida.
5. DTOs con class-validator; errores centralizados en `AllExceptionsFilter`.
6. Rate limits respetados mediante las cabeceras de uso y un backoff exponencial con *full jitter*.
7. Cada decisión técnica relevante queda explicada en el documento correspondiente o en el README.

## 4. Aclaraciones de consistencia

- **Configuración en tiempo de ejecución:** `INBOX_POLL_MINUTES`, `SNAPSHOT_CRON` y `MISSED_POST_GRACE_MINUTES` de `.env` son **valores iniciales**. Los valores efectivos se guardan en `app_settings` (editables desde Ajustes) y tienen prioridad una vez creados.
- **`SESSION_SECRET`:** firma la cookie de sesión (HMAC) como defensa adicional. La sesión se valida en la BD por `token_hash`.
- **Métricas marcadas con 🔍** (`profile_views`, `page_views_total`, `page_daily_follows_unique`/`unfollows_unique`): son preguntas abiertas **intencionadas**. El spike del sprint 0 las resuelve y actualiza el catálogo antes del sprint 3. Si alguna ya no existe, esa clave canónica simplemente no se declara para esa red.
- **DMs de IG y Messenger:** se implementan en el sprint 7. Que funcionen con seguidores sin rol depende de obtener Advanced Access; la UI y el README lo indicarán explícitamente.

## 5. Siguiente paso

Tras aprobar esta especificación, se escribe el **plan de implementación del sprint 0** (skill `writing-plans`). Cada sprint siguiente tendrá su propio plan, que se escribe al empezarlo e incorpora lo aprendido en el anterior.
