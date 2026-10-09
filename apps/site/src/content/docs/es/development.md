---
title: Desarrollo
description: Arranca el monorepo en local, pasa las comprobaciones y oriéntate en el código.
order: 8
---

Garabato es un monorepo de Bun y Turborepo, solo TypeScript. Necesitas [Bun](https://bun.sh) 1.4.2, `openssl`, Docker con Compose 2.22 o superior y un PostgreSQL de desarrollo fuera del proyecto.

## Arrancarlo en local

```bash
bun install
bun run setup:dev   # escribe el .env de la raíz con secretos reales y el admin inicial
```

`setup:dev` imprime las credenciales del administrador que ha generado. Después pon en `DATABASE_URL` del `.env` la dirección de tu PostgreSQL de desarrollo. Todo el repo lee ese único `.env`; [`.env.example`](https://github.com/Nonetss/garabato/blob/main/.env.example) documenta cada variable.

Hay dos formas equivalentes de arrancarlo. Comparten puertos, así que usa una u otra:

```bash
bun run dev         # el stack de desarrollo en Docker con recarga en caliente; Ctrl+C para parar
bun run dev:local   # las apps en nativo con Turbo, más `bun run gateway`
```

En nativo, `bun run minio:start` arranca un MinIO local para los documentos y `bun run loki:start` el registro de actividad.

La app está en <https://localhost:4321>, el gateway de desarrollo (HTTPS y HTTP/2 con una autoridad de certificación local). Enruta exactamente igual que en producción. `bun run dev:cert` exporta el certificado raíz del gateway para que confíes en él en el navegador una sola vez.

No hay ningún paso manual de base de datos: el backend aplica las migraciones del repo y crea el administrador al arrancar.

## Comprobaciones

```bash
bun run check-types      # TypeScript y astro check
bun run check            # lint y formato con Biome
bun run test             # tests unitarios (bun test)
bun run tailwind:check   # lint de las clases de Tailwind
```

Los tests unitarios son herméticos: sin base de datos, red ni servicios en marcha.

## Estructura del repositorio

```text
apps/
  frontend/   Interfaz Astro SSR + React
  backend/    API Hono + oRPC y el scheduler de crons
  gateway/    Caddy: el punto de entrada público
  site/       Esta web
packages/
  api/        Contrato y handlers de oRPC, versionados bajo v1
  auth/       Configuración de Better Auth
  cron/       Scheduler y servicio de crons
  db/         Esquema de Drizzle, migraciones y seed
  env/        Variables de entorno validadas
  logger/     Logger pino compartido
  config/     tsconfig compartido
doc/          Documentación (en español), diagramas y capturas
openspec/     Specs de capacidades y propuestas de cambio
scripts/      setup-dev.sh y el instalador bootstrap
```

## Esta web

La web vive en `apps/site` (Astro, salida estática) y `.github/workflows/pages.yml` la publica en GitHub Pages en cada push a `main` que la toque. Las páginas son ficheros Markdown en `apps/site/src/content/docs/<idioma>/`.

```bash
bun run --filter site dev
```

## Contribuir

Las issues y pull requests son bienvenidas en [GitHub](https://github.com/Nonetss/garabato). Los cambios pasan por OpenSpec y los commits siguen Conventional Commits.
