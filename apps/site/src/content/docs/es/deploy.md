---
title: Desplegar con Docker Compose
description: Instala a mano con compose.prod.yml, ponlo detrás de HTTPS o usa un PostgreSQL o un almacén de objetos externos.
order: 3
---

El instalador solo automatiza estos pasos. Hacerlos a mano te deja el mismo stack de `compose.prod.yml`: el gateway, el frontend, el backend, PostgreSQL y Loki, más MinIO si guardas los documentos en el almacén incluido. Solo el gateway publica un puerto en el host.

## 1. Descarga el fichero compose

En un directorio vacío del servidor:

```bash
curl -fsSL https://raw.githubusercontent.com/Nonetss/garabato/main/compose.prod.yml -o compose.prod.yml
touch .env && chmod 600 .env
```

## 2. Escribe el `.env`

`compose.prod.yml` lee toda su configuración del `.env` que tiene al lado. Genera los secretos:

| Variable | Se genera con |
| --- | --- |
| `POSTGRES_PASSWORD` | `openssl rand -hex 32` |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 48` |
| `CERTIFICATE_ENCRYPTION_KEY` | `openssl rand -base64 32` |
| `S3_SECRET_ACCESS_KEY` (MinIO incluido) | `openssl rand -hex 32` |

Usa hexadecimal para la contraseña de la base de datos: acaba dentro de `DATABASE_URL`, donde `/`, `+` e `=` habría que escaparlos. Después completa el resto:

```bash
FRONTEND_PORT='4444'
CORS_ORIGIN='https://firma.example.com'
POSTGRES_PASSWORD='…'
DATABASE_URL='postgresql://postgres:…@db:5432/stack'
BETTER_AUTH_SECRET='…'
CERTIFICATE_ENCRYPTION_KEY='…'

S3_ENDPOINT='http://minio:9000'
S3_BUCKET='documents'
S3_REGION='us-east-1'
S3_ACCESS_KEY_ID='garabato'
S3_SECRET_ACCESS_KEY='…'
COMPOSE_PROFILES='minio'

ADMIN_NAME='Admin'
ADMIN_EMAIL='admin@example.com'
ADMIN_PASSWORD='…'
```

`CORS_ORIGIN` es la URL pública que ve el navegador; el compose la usa también como URL base de Better Auth. Las comillas simples hacen que Compose lea cada valor tal cual, sin interpolar `$VAR`. La lista completa de variables, con sus valores por defecto, está en [`.env.example`](https://github.com/Nonetss/garabato/blob/main/.env.example); consulta [Configuración](../configuration/).

> Haz copia del `.env`. Sin `CERTIFICATE_ENCRYPTION_KEY`, los certificados y documentos guardados no se pueden descifrar.

## 3. Arranca el stack

```bash
docker compose -f compose.prod.yml --env-file .env pull
docker compose -f compose.prod.yml --env-file .env up -d
```

Al arrancar, el backend aplica las migraciones de la base de datos y crea el administrador si todavía no existe, así que con `up -d` basta. Los servicios arrancan en orden (base de datos, backend, frontend, gateway) y cada uno espera al *healthcheck* del anterior. Con el perfil `minio`, un contenedor de un solo uso, `minio-init`, crea el bucket.

## Detrás de HTTPS

Las cookies de sesión llevan `Secure`, así que los navegadores solo las guardan por HTTPS o en `localhost`: cuenta con HTTPS para cualquier cosa a la que accedan otras máquinas.

El gateway sirve HTTP plano en `FRONTEND_PORT`. Pon delante tu proxy inverso habitual (Caddy, Traefik, nginx…), termina el TLS ahí y reenvía todo a ese puerto. Deja `CORS_ORIGIN` con la URL `https://` que ve el navegador. HSTS le corresponde al proxy que termina el TLS, no al gateway.

El frontend y la API se sirven desde el mismo origen, así que no hay nada más que enrutar: dentro del gateway, `/rpc`, `/api`, `/scalar` y `/openapi.json` van al backend y todo lo demás al frontend.

## Almacén de objetos externo

Para guardar los documentos en tu propio servicio compatible con S3, deja `COMPOSE_PROFILES` sin definir (MinIO no arranca) y apunta las variables `S3_*` a él:

```bash
S3_ENDPOINT='https://s3.eu-west-1.amazonaws.com'
S3_BUCKET='garabato-documents'
S3_REGION='eu-west-1'
S3_ACCESS_KEY_ID='…'
S3_SECRET_ACCESS_KEY='…'
```

El bucket debe existir ya. Los documentos se cifran antes de escribirse y el almacén nunca los sirve directamente: toda descarga pasa por la API.

## PostgreSQL externo

Para usar una base de datos gestionada (RDS, Cloud SQL…), borra de `compose.prod.yml` el servicio `db` y la entrada `depends_on` del backend que apunta a él, y pon su dirección en `DATABASE_URL`:

```bash
DATABASE_URL='postgresql://usuario:contraseña@db.example.com:5432/garabato'
```

## Datos y volúmenes

| Volumen | Contiene |
| --- | --- |
| `db_data` | Usuarios, certificados (cifrados), la biblioteca de documentos, las versiones y el registro de firmas. |
| `minio_data` | Los PDF cifrados, si usas el MinIO incluido. |
| `loki_data` | El registro de actividad de `/admin/logs`, guardado 30 días. |

Haz copia a la vez de la base de datos, el almacén de objetos y el `.env`; consulta [Actualizar y copias de seguridad](../upgrading/).

## La consola de MinIO

La API S3 del MinIO incluido se queda en la red de Docker. Su consola web solo se publica en el loopback del host, en `127.0.0.1:9001`; llega a ella con un túnel SSH:

```bash
ssh -L 9001:127.0.0.1:9001 usuario@servidor
```

Entra con `S3_ACCESS_KEY_ID` y `S3_SECRET_ACCESS_KEY`.
