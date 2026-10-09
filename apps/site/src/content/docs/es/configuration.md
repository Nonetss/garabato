---
title: Configuración
description: Las variables de entorno que define un despliegue, y dónde está la lista completa.
order: 4
---

Toda la configuración de ejecución sale de variables de entorno. En un despliegue con Docker viven en el `.env` junto a `compose.prod.yml`, que leen todos los servicios. El backend valida sus variables al arrancar y se detiene con un error claro si falta alguna o está mal formada.

La lista completa, con cada valor por defecto y un comentario por variable, es [`.env.example`](https://github.com/Nonetss/garabato/blob/main/.env.example) en el repositorio. Estas son las que define un despliegue.

## Despliegue

Las lee el propio `compose.prod.yml`.

| Variable | Notas |
| --- | --- |
| `FRONTEND_PORT` | Puerto del host en el que se publica el gateway. Por defecto `4444`. |
| `POSTGRES_PASSWORD` | Contraseña del servicio `db` incluido. |
| `COMPOSE_PROFILES` | `minio` arranca el MinIO incluido y crea su bucket. Déjala sin definir para usar un almacén externo. |

## Backend

| Variable | Obligatoria | Notas |
| --- | --- | --- |
| `DATABASE_URL` | sí | Cadena de conexión de PostgreSQL. |
| `CORS_ORIGIN` | sí | La URL pública de la app, tal como la ve el navegador. `compose.prod.yml` la pasa también como `BETTER_AUTH_URL`. |
| `BETTER_AUTH_SECRET` | sí | Al menos 32 caracteres. Firma las sesiones y las cookies. |
| `CERTIFICATE_ENCRYPTION_KEY` | sí | Base64 de exactamente 32 bytes. Clave maestra que cifra los certificados y documentos guardados. Haz copia y no la reutilices entre entornos. |
| `S3_ENDPOINT` | sí | Endpoint compatible con S3, una URL completa. El MinIO incluido es `http://minio:9000`. |
| `S3_BUCKET` | sí | El bucket debe existir. El servicio de inicio del MinIO incluido lo crea. |
| `S3_REGION` | no | Por defecto `us-east-1`; MinIO la ignora. |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | sí | Credenciales del almacén. Con el MinIO incluido son también su usuario y contraseña root (al menos 8 caracteres). |
| `TSA_URL` | no | Autoridad de sellado de tiempo RFC 3161. Si está definida, cada firma lleva su sello (PAdES B-T) y falla si la TSA no puede darlo; sin ella, las firmas son B-B. En producción usa una TSA de confianza, como un prestador cualificado de servicios de confianza. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | no | El administrador que se crea al arrancar cuando están las tres. |
| `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_DISCOVERY_URL` | no | Las tres juntas activan el inicio de sesión único. Consulta [Usuarios e inicio de sesión](../authentication/). |
| `LOG_LEVEL` | no | `info` por defecto. |

`compose.prod.yml` define él mismo las direcciones entre contenedores (`BACKEND_URL`, `LOKI_URL`) y `NODE_ENV=production`, así que no hace falta ponerlas en el `.env`.

## Límites

| Qué | Límite |
| --- | --- |
| Subida de un PDF | 20 MiB, sin contraseña. |
| Certificado PKCS#12 | 100 KiB, `.p12` o `.pfx`. |
| Motivo y lugar de la firma | 200 caracteres cada uno. |
