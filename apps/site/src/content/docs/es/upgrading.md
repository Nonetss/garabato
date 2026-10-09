---
title: Actualizar y copias de seguridad
description: Actualiza una instalación en marcha, fija una imagen y haz copia de lo que no se puede reconstruir.
order: 7
---

## La actualización habitual

Desde el directorio que contiene `compose.prod.yml` y `.env`:

```bash
docker compose -f compose.prod.yml --env-file .env pull
docker compose -f compose.prod.yml --env-file .env up -d
```

El backend aplica las migraciones nuevas de la base de datos al arrancar. Actualiza las tres imágenes (gateway, frontend y backend) a la vez.

Si una versión cambia el propio fichero compose, vuelve a descargarlo antes del `pull`. Lee antes las [notas de la versión](https://github.com/Nonetss/garabato/releases).

```bash
curl -fsSL https://raw.githubusercontent.com/Nonetss/garabato/main/compose.prod.yml -o compose.prod.yml
```

## Fijar una imagen

`compose.prod.yml` usa la etiqueta `:main` de `ghcr.io/nonetss/garabato-frontend`, `garabato-backend` y `garabato-gateway`. Cada build de `main` se publica también como `main-<sha>`, con los ocho primeros caracteres del commit. Para quedarte en un build concreto, cambia las tres líneas `image:` a la misma etiqueta `main-<sha>`.

## Copias de seguridad

Una instalación son tres cosas. Haz copia de las tres a la vez, para que encajen:

| Qué | Dónde | Por qué |
| --- | --- | --- |
| La base de datos | el volumen `db_data`, o tu PostgreSQL externo | Usuarios, certificados, la biblioteca, las versiones y el registro de firmas. |
| Los documentos | el volumen `minio_data`, o tu bucket | Los PDF cifrados de cada versión. |
| `.env` | junto a `compose.prod.yml` | Sobre todo `CERTIFICATE_ENCRYPTION_KEY`. |

> **Sin `CERTIFICATE_ENCRYPTION_KEY` las copias no sirven de nada.** Envuelve la clave de cada certificado y documento guardado; sin ella, una base de datos y un bucket restaurados no se pueden descifrar. Guarda una copia fuera del servidor.

Un volcado de la base de datos incluida:

```bash
docker compose -f compose.prod.yml exec db pg_dump -U postgres stack > garabato.sql
```

El volumen de Loki solo guarda el registro de actividad y puede quedarse fuera.
