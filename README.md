# SocialHub

Gestiona tus redes sociales (Instagram, Facebook Pages y LinkedIn; WhatsApp más adelante) desde **tu propia computadora**: calendario editorial, publicación programada, bandeja de comentarios y estadísticas históricas. Open source, sin servidores de terceros: cada instalación usa tus propias apps y credenciales.

> **Estado:** en construcción (sprint 0: fundaciones). Todavía no hay interfaz. Consulta el diseño en [`docs/design/`](docs/design/).

## Requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (en Windows usa WSL2), **o bien** Node.js 24 y PostgreSQL 17 instalados en tu equipo.
- Git.

## Inicio rápido (Docker)

```bash
git clone https://github.com/Ezy01v1/GestorRedes.git && cd GestorRedes
npm run setup          # crea .env y genera claves aleatorias (es seguro repetirlo)
docker compose up -d   # levanta PostgreSQL y la app
```

Comprueba que funciona abriendo <http://127.0.0.1:3000/healthz>: debe responder `{"ok":true}`.

Si el puerto 3000 ya está ocupado en tu equipo, cambia `APP_PORT` en `.env` (por ejemplo, `APP_PORT=3100`) y vuelve a ejecutar `docker compose up -d`.

`npm run setup` solo necesita Node.js. Si no lo tienes, copia `.env.example` a `.env` y rellena a mano `POSTGRES_PASSWORD`, `APP_ENCRYPTION_KEY`, `SESSION_SECRET` y `MEDIA_SIGNING_SECRET` (las tres claves: 32 bytes aleatorios en base64).

## Modo desarrollo

```bash
npm install
npm run setup
docker compose up -d db               # solo la base de datos
npm run prisma:migrate:deploy -w apps/api
npm run start:dev -w apps/api         # API con recarga automática en http://127.0.0.1:3000
```

Pruebas:

```bash
npm test          # unitarias y e2e
npm run test:int  # integración contra PostgreSQL real (requiere Docker)
```

## Seguridad

- La app solo escucha en `127.0.0.1`: no queda expuesta a tu red.
- Los tokens de tus redes se guardan cifrados (AES-256-GCM) con la clave de tu `.env`. **Si pierdes `.env`, tendrás que volver a conectar tus cuentas.**
- `.env` nunca se sube a Git.

## Licencia

[MIT](LICENSE)
