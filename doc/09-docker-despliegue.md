# Docker y despliegue

Hay cuatro ficheros compose, uno por forma de ejecutar el proyecto:

| Fichero | Para qué | Cómo se arranca |
| --- | --- | --- |
| `compose.dev.yml` | Desarrollo con recarga en caliente | `bun run dev` |
| `compose.yml` | Probar en local algo parecido a producción, construido desde el código | `bun run docker:up` |
| `compose.prod.yml` | Producción, con imágenes ya publicadas | En el servidor, con `scripts/bootstrap.sh` |
| `apps/gateway/compose.yml` | Solo el gateway delante de las apps en nativo | `bun run gateway` |

## `compose.dev.yml`: desarrollo

Está explicado en [Desarrollo local](02-desarrollo.md#con-docker-bun-run-dev).
Lo importante: las apps usan la red del host y leen el `.env` sin cambios, así
que se comportan exactamente igual que en nativo. La base de datos
(`better-dev-db`) es la misma que usa `bun run db:start`.

Cuando un servicio empieza a importar un paquete o una carpeta nueva, hay que
añadir su entrada `sync` en este fichero, o los cambios no llegarán al
contenedor.

## `compose.yml`: producción en local

Construye las tres imágenes desde tu copia de trabajo y levanta cinco
servicios. La web queda en `http://localhost:${FRONTEND_PORT:-4444}`.

| Servicio | Puertos | Notas |
| --- | --- | --- |
| `gateway` | publica `FRONTEND_PORT` → 80 | El único que publica un puerto. Espera a que el frontend esté sano. |
| `frontend` | interno 4321 | Solo accesible a través del gateway. Espera al backend. |
| `backend` | interno 3000 | Espera a la base de datos. |
| `db` | ninguno | `postgres:17`, base de datos `better`, volumen `db_data`. |
| `loki` | interno 3100 | Opcional; nadie espera por él. Retención de 720 horas. |

Cada servicio tiene su *healthcheck* y arranca en orden: base de datos →
backend → frontend → gateway. Las direcciones entre contenedores
(`http://backend:3000`, `db:5432`…) se sobrescriben en el propio compose.

Comandos: `docker:build`, `docker:up`, `docker:logs` y `docker:down`.

## `compose.prod.yml`: producción

Usa las imágenes publicadas `ghcr.io/nonetss/stack-{frontend,backend,gateway}:main`
y los mismos cinco servicios en una red `better`. Toda la configuración sale
de un `.env` junto al compose, en el directorio del servidor.

**Solo el gateway publica un puerto.** Un proxy inverso con https delante del
servidor apunta a ese puerto. Una ruta pública nueva se añade en el
`Caddyfile`, nunca publicando el puerto de otro servicio.

No hay pasos manuales de base de datos: el backend aplica las migraciones y
crea el admin al arrancar.

### Instalar en un servidor nuevo

```bash
curl -fsSL https://raw.githubusercontent.com/Nonetss/stack/main/scripts/bootstrap.sh | bash
```

`bootstrap.sh` trabaja en el directorio donde lo ejecutas:

1. Pregunta la URL pública, el puerto y las credenciales del admin.
2. Genera el `.env` con secretos aleatorios.
3. Descarga `compose.prod.yml` si no está. Con `PB_REF=<rama o tag>` puedes
   fijar de qué versión se descarga (las imágenes siguen siendo `:main`).
4. Opcionalmente, arranca el stack.

Se niega a seguir si ya hay un `.env`, así que no machaca una instalación
existente. Avisa si la URL pública es `http://` y no es `localhost`, porque
las cookies `Secure` no funcionarían.

## Las imágenes

### Backend y frontend

- Se construyen y ejecutan sobre `oven/bun:<versión>-slim`, sin Node.
- Primero se copian solo los `package.json` de todos los workspaces y se
  instalan las dependencias; después se copia el resto. Así, cambiar código no
  invalida la capa de dependencias, solo cambiarlas.
- **Las imágenes finales no llevan `node_modules`.** El backend se compila con
  `tsdown` metiendo todas las dependencias en un único fichero, y el frontend
  las empaqueta en `dist/server`. El backend copia además las migraciones.
- Hay un `Dockerfile.dev` por app para `compose.dev.yml`. Producción y CI
  nunca los usan.

### Gateway

`caddy:2-alpine` más el `Caddyfile`, sin paso de compilación.

### Al añadir un workspace nuevo

Hay que añadir la línea que copia su `package.json` en los cuatro Dockerfiles
de las apps (`apps/backend/Dockerfile`, `apps/frontend/Dockerfile` y sus
`Dockerfile.dev`) y su entrada `sync` en `compose.dev.yml`.

## CI

`.github/workflows/docker-build.yml` se ejecuta en cada push a `main`:

1. Detecta qué imágenes cambiaron: el backend y el frontend si cambió su app,
   `packages/` o los manifiestos de la raíz; el gateway si cambió
   `apps/gateway/`. Si cambia el propio workflow o `.dockerignore`, se
   reconstruyen las tres.
2. Construye solo esas y las sube al GitHub Container Registry con las
   etiquetas `latest`, el nombre de la rama y `<rama>-<sha>`, usando una caché
   de capas en el propio registry.

Se autentica con el `GITHUB_TOKEN` del workflow, así que no hay que configurar
ningún secreto. El CI **no** ejecuta lint, tipos ni tests: eso se valida en
local antes de hacer push.
