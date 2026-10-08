# Configuración

## Un solo `.env`

Todo el proyecto se configura con **un único fichero `.env` en la raíz**. No
hay `.env` por app ni por paquete. `.env.example` documenta todas las
variables con su valor por defecto: es la referencia, así que esta página no
repite la lista entera.

### Quién lo lee

| Lector | Qué valida |
| --- | --- |
| `packages/env/src/server.ts` (`@nonete/env/server`) | Las variables del backend y de los paquetes, con zod. Si falta una obligatoria, el backend no arranca. |
| `packages/db/drizzle.config.ts` | `DATABASE_URL`, para los comandos de Drizzle. |
| `apps/frontend/astro.config.mjs` | Las variables de servidor del frontend (`BACKEND_URL`, `LOKI_URL`) con `astro:env`. |

### Cómo se encuentra el fichero

Cada lector abre `../../.env` relativo a su directorio de trabajo. Funciona
porque todos los workspaces están dos niveles por debajo de la raíz y Turbo y
`bun --filter` ejecutan los scripts desde ahí. Consecuencias:

- Una variable ya definida en el entorno del proceso **gana** al fichero.
- Si el fichero no existe no pasa nada. Es lo que ocurre en los contenedores,
  donde las variables las pone docker compose.
- Si ejecutas un script desde otro directorio (por ejemplo
  `bun apps/backend/src/index.ts` desde la raíz), no encontrará el `.env`.

## Las variables importantes

Cada concepto tiene **un solo nombre**. No inventes un segundo nombre para
algo que ya existe.

| Variable | Significado |
| --- | --- |
| `NODE_ENV` | Entorno de ejecución. En `production`, los logs salen como JSON. |
| `DATABASE_URL` | La única configuración de base de datos que leen las apps. |
| `BETTER_AUTH_URL` | La URL base de Better Auth (el backend). Solo la lee el backend. |
| `BETTER_AUTH_SECRET` | Firma sesiones y cookies. Al menos 32 caracteres (`openssl rand -base64 48`). |
| `CORS_ORIGIN` | El origen público que usa el navegador. Se usa para CORS y como origen de confianza de Better Auth. |
| `BACKEND_URL` | Cómo llega el frontend al backend: consultas de sesión en SSR y el proxy de `astro dev`. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | El administrador que se crea al arrancar el backend si no existe. Los jobs de cron declarados en código se ejecutan como este usuario. |
| `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_DISCOVERY_URL` | Inicio de sesión con un proveedor OIDC. Solo se activa si están las tres. |
| `LOKI_URL` | Opcional. Si está, los logs se envían a Loki y aparece el registro de actividad. |
| `LOG_LEVEL` | Nivel mínimo de log (por defecto `info`). |
| `SKIP_ENV_VALIDATION` | Desactiva la validación. Solo para builds y tareas de CLI; los Dockerfiles lo usan al compilar. |

### Trampas habituales

- **`ADMIN_EMAIL` tiene que ser un email válido.** `admin@localhost` no pasa
  la validación y el backend no arranca. `setup:dev` usa `admin@better.local`.
- **Las cookies son `Secure`.** Sobre `http` plano el navegador solo las
  guarda en `localhost`. En un servidor hay que servir la web por https o no
  se podrá iniciar sesión.
- **Las direcciones entre contenedores no van en el `.env`.** Cuando las apps
  corren en contenedores, los compose sobrescriben `BACKEND_URL`,
  `DATABASE_URL`, etc. con los nombres de servicio (`http://backend:3000`,
  `db:5432`…). El `.env` siempre usa `localhost`.
- **Las variables del gateway** (`GATEWAY_HTTP_PORT`, `BACKEND_HTTP_UPSTREAM`,
  `FRONTEND_HTTP_UPSTREAM`) las ponen los compose. No hace falta tocarlas.

## El `.env` de producción es otro fichero

Un despliegue tiene su propio `.env`, junto a `compose.prod.yml`, en el
directorio del servidor. Lo genera `scripts/bootstrap.sh`, que pregunta la URL
pública y las credenciales del admin y crea `FRONTEND_PORT`, `CORS_ORIGIN`,
`POSTGRES_PASSWORD`, `DATABASE_URL`, `BETTER_AUTH_SECRET` y los `ADMIN_*`.

`bootstrap.sh` se niega a ejecutarse si ya hay un `.env`. Por eso nunca debe
ejecutarse dentro de tu copia de trabajo: para probar producción en local usa
otro directorio, o `bun run docker:up` aquí.

## Añadir una variable nueva

En el mismo cambio:

1. Añádela al esquema de quien la lee (`packages/env/src/server.ts` o el
   `env.schema` de `astro.config.mjs`).
2. Documéntala en `.env.example`, en la sección que le corresponda.
3. Si es obligatoria en `packages/env/src/server.ts`, añade un valor de mentira
   en `packages/api/tests/setup.ts` para que los tests sigan funcionando sin
   `.env`.
4. Si la necesita un contenedor con un valor distinto, ponlo en el
   `environment` del compose correspondiente.
