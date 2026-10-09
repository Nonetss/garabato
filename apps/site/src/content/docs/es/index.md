---
title: Primeros pasos
description: Instala Garabato en un servidor Linux con un solo comando e inicia sesión por primera vez.
order: 1
---

Garabato firma PDF con tus propios certificados digitales. Importas un certificado PKCS#12, sueltas un PDF, colocas la firma visible y descargas el archivo firmado. Los certificados y los documentos se guardan cifrados. Se distribuye como tres imágenes de Docker (gateway, frontend y backend), más PostgreSQL y, opcionalmente, un MinIO incluido para los documentos.

## Requisitos

- Un host Linux con Docker y el plugin de Compose (`docker compose`).
- `curl` y `openssl`, que el instalador usa para descargar ficheros y generar secretos.
- HTTPS delante para cualquier cosa que no sea `localhost`: las cookies de sesión son `Secure`.

## Instalar con un solo comando

Crea un directorio vacío para el despliegue, entra en él y ejecuta:

```bash
curl -fsSL https://raw.githubusercontent.com/Nonetss/garabato/main/scripts/bootstrap.sh | bash
```

El script es interactivo aunque se ejecute con una tubería, porque lee las respuestas del terminal. Pregunta:

1. El **puerto** que se publica en el host (por defecto `4444`) y la **URL pública** que usará el navegador (por ejemplo `https://firma.example.com`). Avisa si la URL es `http://` y no es `localhost`, porque el inicio de sesión fallaría.
2. El **primer administrador**: nombre, email y una contraseña de al menos 8 caracteres.
3. Dónde **guardar los documentos**: en el MinIO incluido (por defecto) o en un almacén externo compatible con S3, cuyo bucket ya debe existir.

Después genera todos los secretos con `openssl`, escribe `.env` (con permisos `600`), descarga `compose.prod.yml` si no está y, si se lo pides, descarga las imágenes de `ghcr.io` y arranca el stack. Se niega a seguir si ya hay un `.env`, así que nunca machaca una instalación. Con `PB_REF` en el lado de `bash` (`… | PB_REF=v0.1.0 bash`) eliges qué versión de `compose.prod.yml` descarga (por defecto `main`); las imágenes que referencia siguen en `:main`.

> **Haz copia del `.env`**, sobre todo de `CERTIFICATE_ENCRYPTION_KEY`. Cifra los certificados y documentos guardados; si la pierdes, no se pueden recuperar.

## Iniciar sesión

El backend aplica las migraciones de la base de datos y crea el administrador del `.env` al arrancar, así que no hay ningún paso de configuración aparte. Pasados uno o dos minutos, abre la URL pública e inicia sesión con el email y la contraseña que elegiste.

## Siguientes pasos

- [Tu primera firma](./first-run/): importa un certificado, firma un PDF y descárgalo.
- [Desplegar con Docker Compose](./deploy/): la misma instalación a mano, detrás de HTTPS, o con una base de datos o un almacén de objetos externos.
- [Configuración](./configuration/): las variables de entorno que importan.
