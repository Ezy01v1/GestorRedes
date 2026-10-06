# Paso 1 — Viabilidad de las APIs oficiales

> Estado: borrador para revisión · Fecha: 2026-10-05
> Versión de referencia de Meta Graph API: **v26.0** (publicada el 29-jul-2026).
> Leyenda: ✅ viable · ⚠️ viable con restricciones · ❌ inviable o no recomendable · 🔍 hay que validarlo en un spike

---

## 0. Resumen (TL;DR)

| Red | Publicar | Comentarios | DMs | Estadísticas | Veredicto MVP |
|---|---|---|---|---|---|
| Instagram (Business/Creator) | ✅ (requiere **URL pública** del medio) | ✅ | ⚠️ solo con usuarios con rol en la app, salvo App Review 🔍 | ✅ muy completas | ✅ |
| Facebook Pages | ✅ | ✅ | ⚠️ igual que IG 🔍 | ✅ (métricas cambiadas en 2025–2026) | ✅ |
| LinkedIn perfil personal | ✅ | ❌ | ❌ | ❌ sin Community Management API | ⚠️ solo publicar |
| LinkedIn Company Page | ⚠️ requiere aprobación + empresa legal | ⚠️ ídem | ❌ | ⚠️ ídem | ⚠️ opcional |
| WhatsApp Cloud API | ✅ plantillas / respuestas | n/a | ✅ **solo por webhook** (necesita URL pública) | ⚠️ solo mensajes, sin seguidores | Fase 2 ✅ |

**Los 5 riesgos que condicionan la arquitectura (te los digo de entrada):**

1. **Bandeja de DMs en Meta (IG y Messenger):** en modo desarrollo con *Standard Access* solo se reciben y envían mensajes con personas que tienen rol en la app (admin/dev/tester). Los DMs de tus seguidores reales requieren *Advanced Access* de `instagram_manage_messages` / `pages_messaging`, es decir, **App Review + verificación del negocio**. La bandeja de **comentarios** sobre tu propio contenido sí debería funcionar en modo desarrollo. 🔍 Lo validamos en un spike en el sprint 0, antes de comprometer la funcionalidad.
2. **Instagram (y Threads) publican desde una URL pública:** Meta descarga la imagen/video desde `image_url`/`video_url`. Una app local no tiene URL pública. Hay tres salidas oficiales: (a) túnel temporal (Cloudflare Tunnel o ngrok) que expone solo `/public-media/<token-firmado>` mientras se publica; (b) bucket S3-compatible del propio usuario (R2, S3, MinIO); (c) para videos, la subida reanudable (*resumable upload*) de Meta 🔍. Facebook Pages y LinkedIn **sí** aceptan subida binaria directa, sin URL pública.
3. **Sin servidor público no hay webhooks:** Meta solo los entrega a una URL HTTPS pública. Para IG y FB usaremos **polling con cron**, que es suficiente para un solo usuario. **WhatsApp no tiene API para leer mensajes entrantes: solo llegan por webhook**, así que la Fase 2 necesita sí o sí el túnel del punto 2.
4. **LinkedIn está muy cerrado para individuos:** sin la *Community Management API* (que exige una empresa legalmente registrada y aprobación manual) solo puedes **publicar en tu perfil personal**. No hay estadísticas, ni lectura de comentarios, ni DMs, y el token dura 60 días sin refresh, así que hay que reconectar cada dos meses.
5. **La app local no siempre está encendida:** si el PC está apagado a la hora programada, el post no sale y el snapshot diario no se toma. Hace falta una política de "recuperación al arrancar" (detalle en el paso 2). Instagram permite rellenar huecos: algunas métricas diarias devuelven los últimos 30 días.

---

## 1. Meta — configuración común (Instagram, Facebook, WhatsApp, Threads)

### 1.1 Modo desarrollo vs. App Review

- Cada usuario del repo crea **su propia app** en developers.facebook.com, de tipo *Business* y con los casos de uso correspondientes.
- En **modo desarrollo** todos los permisos están en *Standard Access*: funcionan **sin App Review** siempre que la persona que autoriza tenga un rol en la app. Este es justo nuestro caso, porque el dueño de la instalación es admin de su propia app.
- *Advanced Access* (App Review + Business Verification) **solo** hace falta para interactuar con datos de personas sin rol. El caso que nos afecta son los DMs entrantes (riesgo 1).
- Instagram con *Instagram Login*: hay que añadir la cuenta IG como **Instagram Tester** en la app y aceptar la invitación desde la propia app de Instagram (Configuración → Apps y sitios web → Invitaciones de prueba). Esto irá en el README.
- Las cuentas personales de IG **no** están soportadas; la cuenta tiene que ser Business o Creator.

### 1.2 Dos caminos para Instagram (decisión a tomar)

| | **A. Instagram API with Instagram Login** (recomendado) | B. Instagram API with Facebook Login |
|---|---|---|
| ¿Requiere Página de FB vinculada? | No | Sí |
| Scopes | `instagram_business_basic`, `instagram_business_content_publish`, `instagram_business_manage_comments`, `instagram_business_manage_messages`, `instagram_business_manage_insights` | `instagram_basic`, `instagram_content_publish`, `instagram_manage_comments`, `instagram_manage_insights`, `instagram_manage_messages`, `pages_show_list`, `pages_read_engagement` |
| Token | Long-lived de 60 días, **refrescable** con `GET /refresh_access_token` (el token debe tener al menos 24 h y seguir válido) | Page token derivado de un user token long-lived, **no expira** (salvo que cambies la contraseña o revoques el permiso) |
| Flujos OAuth | Uno para IG y otro para FB | Uno solo para IG + FB |

**Recomendación: A.** Es el camino que Meta está priorizando, no obliga a los creadores a tener una Página, y desacopla IG de FB, así que si una conexión falla la otra sigue funcionando. Renovar el token es un cron trivial. El precio es tener dos botones de "Conectar" en lugar de uno.

### 1.3 Límites de tasa (Meta)

- Meta usa *Business Use Case (BUC) rate limits* por cuenta en ventanas de 24 h y devuelve el consumo en las cabeceras `X-App-Usage`, `X-Business-Use-Case-Usage` y `X-Ad-Account-Usage`.
- Con un solo usuario y polling razonable (cada 5–15 min) estamos muy por debajo. Aun así, el cliente HTTP **leerá esas cabeceras** y frenará solo al pasar del 80 %. Los errores 4, 17, 32 y 613 se tratarán con *backoff* exponencial con jitter.
- Publicación en IG: **100 posts por 24 h** (ventana móvil; un carrusel cuenta como uno). Se consulta en `GET /<IG_ID>/content_publishing_limit`.
- Las métricas se deprecan con frecuencia (abril 2025, noviembre 2025, junio 2026). Por eso: **versión de Graph API fijada y configurable** (`META_GRAPH_VERSION=v26.0`), métricas guardadas en **JSONB** y un **catálogo de métricas por proveedor** en el código, para que un cambio de Meta solo toque un adaptador.

---

## 2. Instagram (Business / Creator)

### Capacidades
- **Publicar:** imagen (solo JPEG), video, Reels, carrusel (hasta 10 elementos) y Stories. Es un proceso en dos pasos: crear el contenedor (`POST /<IG_ID>/media`) y publicarlo (`POST /<IG_ID>/media_publish`). Los videos necesitan consultar el estado del contenedor hasta que pase a `FINISHED`. ⚠️ Requiere URL pública (riesgo 2).
- **Programación nativa:** la API no tiene programación nativa, así que nuestro cron publica a la hora indicada.
- **Comentarios:** listar, responder, ocultar y eliminar comentarios de tus medios ✅.
- **DMs:** Conversations API (`GET /me/conversations`, `/messages`) ⚠️ con la limitación del riesgo 1. Las respuestas solo se pueden enviar dentro de la ventana de 24 h.
- **Menciones / hashtags:** fuera del alcance del MVP.

### Métricas disponibles
| Métrica pedida | Disponible | Fuente |
|---|---|---|
| Seguidores | ✅ | campo `followers_count` |
| Seguidos | ✅ | campo `follows_count` |
| Publicaciones totales | ✅ | campo `media_count` |
| Ganados/perdidos por día | ✅ (cuentas con ≥100 seguidores) | insight `follows_and_unfollows`; `follower_count` (nuevos seguidores por día, últimos 30 días, **permite backfill**) |
| Alcance | ✅ | `reach` |
| Impresiones | ❌ deprecada (abril 2025) → **`views`** | `views` |
| Visitas al perfil | ✅ 🔍 confirmar nombre vigente | `profile_views` |
| Interacciones | ✅ | `likes`, `comments`, `shares`, `saves`, `replies`, `total_interactions`, `accounts_engaged` |
| Engagement rate | ✅ calculada por nosotros | `total_interactions / reach` (o `/ followers`, configurable) |
| Mejores horarios | ✅ | `online_followers` (seguidores activos por hora, ≥100 seguidores) **más** nuestro propio histórico de rendimiento por hora de publicación |
| Por publicación | ✅ | media insights: `reach`, `views`, `likes`, `comments`, `shares`, `saved`, `total_interactions` (Reels: tiempo medio de visualización) |

**Notas que afectan al diseño:**
- **Las métricas de Stories solo existen durante 24 h.** Hay que tomar un snapshot de cada Story activa antes de que caduque (cron horario).
- Los insights de cuenta tienen un rango máximo por consulta (unos 30 días) y una retención limitada. El historial largo de seguidores **solo** lo tendremos con nuestros snapshots, lo que confirma tu idea.
- La demografía y `online_followers` exigen un mínimo de 100 seguidores.

---

## 3. Facebook Pages

### Capacidades
- **Publicar:** texto, enlace, foto (subida **multipart directa**, sin URL pública), video y Reels de página. Además tiene **programación nativa** (`published=false` + `scheduled_publish_time`, entre 10 min y 30 días). Esto sirve de red de seguridad si el PC está apagado: los posts de FB pueden delegarse a Meta (opción configurable).
- **Comentarios:** leer, responder, ocultar y eliminar ✅ (`pages_read_user_content`, `pages_manage_engagement`).
- **Mensajes (Messenger):** `pages_messaging` ⚠️ con el riesgo 1.
- Permisos: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `pages_read_user_content`, `pages_manage_engagement`, `read_insights`, `pages_messaging`.

### Métricas disponibles (situación a octubre 2026)
| Métrica pedida | Disponible | Fuente |
|---|---|---|
| Seguidores | ✅ | campo `followers_count`; insight `page_follows` |
| Seguidos | ❌ **no existe el concepto en Páginas** | — |
| "Me gusta" de la página | ❌ `page_fans` deprecada (15-nov-2025) | sustituida por seguidores |
| Publicaciones totales | ⚠️ no existe un campo directo | se cuenta paginando `/published_posts` (o la mantenemos con nuestros snapshots) |
| Ganados/perdidos por día | ✅ 🔍 | `page_daily_follows_unique` / `page_daily_unfollows_unique` (confirmar vigencia en v26) |
| Alcance | ⚠️ `page_impressions_unique` retirada (junio 2026) → **`page_total_media_view_unique`** ("media viewers") | no equivale 1:1 al alcance anterior; ya no hay desglose pagado/orgánico |
| Impresiones | ❌ deprecada (nov 2025) → **`page_media_view`** | |
| Visitas al perfil | 🔍 | `page_views_total` (verificar que no esté deprecada) |
| Interacciones | ✅ | `page_post_engagements`; por post: reacciones, comentarios, compartidos (`post_media_view`, `post_total_media_view_unique`) |
| Guardados | ❌ | no expuesto en Páginas |

**Implicación:** en la UI, la etiqueta "Alcance" de Facebook tendrá un tooltip que diga "Media viewers (métrica de Meta desde 2026)". Para mantener la honestidad de los datos, nunca mezclaremos en una misma serie valores anteriores y posteriores a un cambio de métrica sin marcarlo.

---

## 4. LinkedIn

### 4.1 Productos y lo que desbloquean

| Producto LinkedIn | Acceso | Qué permite |
|---|---|---|
| **Sign In with LinkedIn using OpenID Connect** | Self-serve, inmediato | `openid profile email` → identificar al usuario (su URN) |
| **Share on LinkedIn** | Self-serve, inmediato | `w_member_social` → **publicar en el perfil personal**: texto, imagen, video, documento, artículo/enlace |
| **Community Management API** | ⚠️ Solicitud con revisión manual. **Solo empresas legalmente registradas** (LLC, S.A., ONG…), con página verificada, web, política de privacidad y email corporativo. **Debe ser el único producto de su app**, así que hace falta una segunda app de LinkedIn | Publicar y gestionar comentarios en **Company Pages** (`w_organization_social`, `r_organization_social`); estadísticas de página; **analíticas del perfil personal**: `r_member_postAnalytics`, `GET /memberFollowersCount`, `GET /memberCreatorPostAnalytics` (impresiones, miembros alcanzados, reacciones, comentarios, reshares) |

- El tier de desarrollo de la Community Management API está limitado a 500 llamadas/día por app y 100 por miembro, sin `BATCH_GET`. Para un solo usuario con un cron diario alcanza.
- **No hay API de mensajes directos** para nadie fuera de partners cerrados ❌.
- **Tokens:** duran 60 días. Los productos self-serve **no** dan refresh token, así que la app avisará 7 días antes de que caduque y pedirá reconectar.
- Versionado: cabecera `LinkedIn-Version: YYYYMM`; cada versión se mantiene alrededor de un año. La fijaremos en configuración.

### 4.2 Métricas
| Métrica | Perfil (solo Share on LinkedIn) | Perfil + Community Mgmt | Company Page + Community Mgmt |
|---|---|---|---|
| Seguidores | ❌ | ✅ `memberFollowersCount` (total y por rango de fechas) | ✅ follower statistics |
| Seguidos | ❌ | ❌ | ❌ |
| Impresiones / alcance | ❌ | ✅ | ✅ |
| Interacciones por post | ❌ | ✅ | ✅ |
| Visitas al perfil | ❌ | ❌ | ✅ page statistics |

**Veredicto:** en el MVP, LinkedIn será **"publicar en el perfil personal"**, que funciona para cualquiera que clone el repo. Las estadísticas y las Company Pages quedan como **módulo opcional** que se activa si el usuario tiene acceso aprobado a la Community Management API. El README lo explicará sin rodeos.

---

## 5. WhatsApp Business Cloud API (Fase 2)

- **Acceso:** el acceso a la API es gratuito. Necesitas un Business Portfolio de Meta y la app con el caso de uso WhatsApp. Meta te da un **número de prueba** que puede escribir a un máximo de 5 destinatarios verificados, ideal para desarrollo. Para producción se registra un número propio; desde 2025 la *coexistence* permite usar el mismo número en la app WhatsApp Business y en la Cloud API.
- **Recibir mensajes: SOLO por webhook** (no existe un endpoint para listar conversaciones). Sin túnel HTTPS público no hay bandeja de WhatsApp. Este es el motivo por el que el túnel será un componente de primera clase.
- **Enviar:** dentro de la ventana de 24 h desde el último mensaje del cliente se puede responder libremente. Fuera de ella, solo con **plantillas aprobadas** por Meta (marketing, utility, authentication). Las plantillas se crean y consultan por API.
- **Costos (importante, cambió el 1-oct-2026):**
  - Plantillas: se cobran por mensaje entregado, según país y categoría (p. ej. en EE. UU. marketing ≈ $0.025, utility ≈ $0.004).
  - **Desde el 1-oct-2026 Meta vuelve a cobrar los mensajes de servicio** (respuestas dentro de la ventana de 24 h) y las plantillas utility enviadas dentro de la ventana. Hay **1.000 mensajes de servicio gratis al mes por número**.
  - **Sin método de pago registrado en Meta, los mensajes de servicio dejan de entregarse.** Esto debe ir en el README en un recuadro de advertencia.
- **Límites:** los números no verificados tienen un límite bajo de conversaciones iniciadas por el negocio por día. La verificación del negocio lo amplía. El throughput técnico es de unos 80 msg/s, irrelevante para nosotros.
- **Estadísticas:** WhatsApp **no tiene seguidores**. Sí se pueden obtener mensajes enviados, entregados y leídos, analítica de plantillas y costos (`analytics`, `pricing_analytics`, `template_analytics`). El snapshot de WhatsApp tendrá otra forma (por eso JSONB).

---

## 6. Fase 3 — evaluación y recomendación

| Red | API oficial | Costo | Restricción clave | Dificultad | Recomendación |
|---|---|---|---|---|---|
| **Threads** | Threads API (Meta) | Gratis | Medios por URL pública (el mismo túnel); token de 60 días refrescable; testers en modo desarrollo | Baja: reutiliza la infraestructura de Meta | ✅ **1ª prioridad.** Publicar, responder, insights (views, likes, replies, reposts, quotes, followers, demografía) |
| **YouTube** | Data API v3 + YouTube Analytics API | Gratis (10.000 unidades/día) | Subir un video es caro en cuota. **Los proyectos no auditados suben los videos como privados.** Con la pantalla de consentimiento de Google en modo "Testing", **los refresh tokens caducan a los 7 días**: hay que pasarla a "In production" (sin verificar, uso personal) | Media | ✅ **2ª.** Analytics excelente y con **historial nativo** (suscriptores ganados/perdidos por día). Publicar sería "subir como privado/oculto y publicar desde YouTube" |
| **X / Twitter** | X API v2 | **De pago** por uso desde feb-2026 (sin plan gratis): ≈ $0.015 por post, **$0.20 si el post lleva URL**, lecturas propias ≈ $0.001 | Créditos prepagados | Baja técnicamente | ⚠️ **3ª, opcional.** Para un uso personal cuesta unos pocos dólares al mes, pero obliga a cada usuario a pagar. Conector desactivado por defecto |
| **Pinterest** | API v5 | Gratis | En *Trial* los pines **solo los ve su creador**. *Standard* exige enviar a revisión un video de la app funcionando, y cada usuario del repo tendría que hacerlo | Media | ⚠️ 4ª, baja prioridad |
| **Google Business Profile** | Business Profile APIs | Gratis | Hay que **solicitar acceso** (formulario; cuota 0 hasta la aprobación). Solo tiene sentido para negocios locales | Media | ⚠️ 5ª, solo si te interesa un negocio local |
| **TikTok** | Content Posting API + Display API | Gratis | Las apps **no auditadas publican solo en privado** y con un máximo de 5 usuarios/día. La auditoría es por app, así que **cada persona que clone el repo tendría que pasarla** | Alta | ❌ **No recomendado** para un proyecto self-hosted. Como mucho, un modo "subir a borradores" 🔍 |

---

## 7. Implicaciones para la arquitectura (entrada del paso 2)

1. **Patrón adaptador por red** (`ProviderAdapter`: `connect`, `refreshToken`, `publish`, `fetchComments`, `fetchMessages`, `fetchSnapshot`, `capabilities()`). La UI se construye a partir de `capabilities()`, para que no aparezca "Seguidos" en Facebook ni "Seguidores" en WhatsApp.
2. **Polling por cron** para comentarios y DMs de Meta, en lugar de webhooks.
3. **Túnel opcional integrado** (Cloudflare Tunnel u ngrok) para dos cosas: servir medios a IG/Threads con URLs firmadas y temporales, y recibir webhooks de WhatsApp. Alternativa: un bucket S3-compatible.
4. **Snapshots diarios en JSONB más un catálogo de métricas versionado**, con recuperación al arrancar y *backfill* donde la API lo permita (IG `follower_count` de 30 días, YouTube Analytics).
5. **Cron horario de Stories** de IG (métricas que viven 24 h).
6. **Recuperación de publicaciones** si el PC estaba apagado: publicar tarde, marcar como "perdida" o (solo en FB) delegar en la programación nativa de Meta.
7. **Gestor de tokens** con cifrado AES-256-GCM, renovación automática (IG, Threads, Google) y avisos de reconexión (LinkedIn, 60 días).
8. **Cliente HTTP común** con lectura de cabeceras de uso, *backoff* exponencial con jitter, idempotencia en la publicación (no duplicar un post si un reintento llega después de un timeout) y redacción de tokens en los logs.

---

## 8. Spike recomendado para el sprint 0 (antes de comprometer funciones)

1. Con tu app de Meta en modo desarrollo y tu cuenta IG como tester: ¿`GET /me/conversations` devuelve DMs de un seguidor **sin rol** en la app? ¿Y los comentarios de ese seguidor en tu post?
2. Publicar una imagen en IG servida desde Cloudflare Tunnel (quick tunnel) con URL firmada.
3. Confirmar los nombres vigentes en v26.0 de `profile_views`, `page_views_total` y `page_daily_follows_unique`.

---

## Fuentes consultadas
- Meta — Page Insights API updates (ago-2025): https://developers.facebook.com/blog/post/2025/08/15/page-insights-api-updates/
- Meta — Page/insights reference: https://developers.facebook.com/docs/graph-api/reference/insights/
- Meta — Graph API versions: https://developers.facebook.com/docs/graph-api/changelog/versions/
- Meta — Instagram content publishing: https://developers.facebook.com/docs/instagram-platform/content-publishing/
- Meta — Instagram Platform overview: https://developers.facebook.com/docs/instagram-platform/overview/
- Meta — Messenger webhooks: https://developers.facebook.com/documentation/business-messaging/messenger-platform/webhooks
- Meta — WhatsApp pricing: https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing
- Meta — Cambios de precios de mensajes de servicio y utility: https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/non-template-messages
- Emplifi — Deprecación de métricas de IG (abr-2025): https://docs.emplifi.io/platform/latest/home/instagram-insights-metrics-deprecation-april-2025
- Emplifi — Deprecación de métricas de FB (jun-2026): https://docs.emplifi.io/platform/latest/home/facebook-metric-deprecation-june-2026
- Supermetrics — Cambios de campos de Facebook Insights (30-jun-2026): https://docs.supermetrics.com/docs/facebook-insights-field-changes-june-30-2026
- LinkedIn — Member Post Statistics: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/members/post-statistics?view=li-lms-2025-11
- LinkedIn — Member Follower Statistics: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/members/follower-statistics?view=li-lms-2026-05
- LinkedIn — Increasing Access: https://learn.microsoft.com/en-us/linkedin/marketing/increasing-access?view=li-lms-2026-06
- LinkedIn — Recent Marketing API changes: https://learn.microsoft.com/en-us/linkedin/marketing/integrations/recent-changes?view=li-lms-2026-01
- TikTok — Content Posting API, Direct Post: https://developers.tiktok.com/docs/en/content-posting-api-get-started
- Pinterest — Access tiers: https://developers.pinterest.com/docs/key-concepts/access-tiers/
- Precios de la X API 2026 (resumen de terceros): https://postproxy.dev/blog/x-api-pricing-2026/
