---
title: Arquitectura
description: Cómo encajan el gateway, el frontend, el backend, la base de datos y el almacén de objetos, y cómo se protegen los certificados y documentos.
order: 5
---

Garabato es un monorepo con dos apps detrás de un gateway Caddy, más PostgreSQL y un almacén de objetos compatible con S3. Solo el gateway publica un puerto, así que el navegador ve un único origen y nunca habla directamente con el backend, la base de datos ni el almacén.

| Servicio | Stack | Puerto | Papel |
| --- | --- | --- | --- |
| Gateway | Caddy | `80` (publicado como `FRONTEND_PORT`) | Punto de entrada HTTP público. El único sitio que reparte rutas entre apps. |
| Frontend | Astro SSR, React | `4321` (interno) | La interfaz web. |
| Backend | Bun, Hono, oRPC, Better Auth, Drizzle | `3000` (interno) | Autenticación, la API y la firma. Es el dueño de la base de datos y del almacén. |
| PostgreSQL | PostgreSQL 17 | `5432` (interno) | Usuarios, certificados, la biblioteca, las versiones, los registros de firma y las trazas. |
| MinIO | Compatible con S3 | `9000` (solo interno, no publica nada) | Los PDF cifrados. Opcional: vale cualquier almacén externo compatible con S3. |
| Loki | Grafana Loki | `3100` (interno) | Registro de actividad opcional, consultable en `/admin/logs`. |

## Recorrido de las peticiones

El gateway manda `/rpc`, `/api`, `/scalar` y `/openapi.json` al backend y cualquier otra ruta al frontend. `/health` responde `ok` para el *healthcheck*. Como la web y la API comparten origen, el navegador nunca hace llamadas entre orígenes y las cookies de sesión funcionan sin más.

Al arrancar, el backend aplica las migraciones de la base de datos y crea el administrador del `.env`.

## Anatomía de una firma

1. Pulsas firmar en el visor. El frontend llama al backend por oRPC con la versión del documento que estás viendo, el certificado, dónde va el sello y el motivo y el lugar opcionales.
2. El backend comprueba tu sesión y que tanto el documento como el certificado son tuyos.
3. Descifra el certificado (con la contraseña que escribiste o la recordada) y la versión actual del PDF.
4. Dibuja el sello visible, si lo hay, y firma el PDF: una firma CAdES separada sobre SHA-256, con el atributo ESS signing-certificate-v2 y la cadena del emisor incluida, con `SubFilter ETSI.CAdES.detached` (PAdES básica B-B). Si `TSA_URL` está definida, pide a esa autoridad de sellado de tiempo un sello RFC 3161 sobre la firma y lo incrusta (B-T); si la TSA no lo da, la firma falla en lugar de guardarse como B-B.
5. El PDF firmado se cifra y se guarda como una nueva versión, y se añade un registro al historial de firmas.

## Modelo de seguridad

- **Cifrado de sobre.** Cada certificado y cada documento tiene su propia clave de datos aleatoria, envuelta con la clave maestra `CERTIFICATE_ENCRYPTION_KEY`. Los valores (el fichero PKCS#12, una contraseña recordada, cada versión de un documento) se sellan con AES-256-GCM, ligados al registro y al hueco al que pertenecen, así que un valor solo se abre donde se selló.
- **El almacén solo guarda texto cifrado.** Los PDF se cifran antes de escribirse en el almacén de objetos, y el almacén nunca sirve archivos directamente: toda descarga pasa por la API, que la descifra.
- **Las contraseñas de los certificados no se guardan**, salvo que pidas a la app que recuerde una, y entonces se cifra igual.
- **Todo es por usuario.** Los documentos y certificados pertenecen al usuario con sesión; los de otro usuario responden como no encontrados.
- **Las sesiones** son cookies `httpOnly`, `Secure` y `SameSite=Lax`. `/rpc` nunca acepta `GET` y `/api` rechaza las navegaciones de nivel superior desde otra web, lo que deja fuera el CSRF sin ningún plugin en el cliente.

## La API

La API está versionada bajo `/rpc/v1` (oRPC, la que usa el frontend) y `/api/v1` (OpenAPI, para scripts y otros servicios). La referencia interactiva está en `/scalar` y la especificación en `/openapi.json`, las dos solo para administradores.

Desde scripts, autentícate con una API key enviada en la cabecera `x-api-key` (consulta [Usuarios e inicio de sesión](../authentication/)):

```bash
curl -H "x-api-key: $GARABATO_KEY" https://firma.example.com/api/v1/document/list
```
