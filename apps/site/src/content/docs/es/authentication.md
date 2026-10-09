---
title: Usuarios e inicio de sesión
description: Cuentas, el rol de administrador, el primer administrador, inicio de sesión único con cualquier proveedor OIDC y API keys.
order: 6
---

El inicio de sesión lo gestiona Better Auth. Todas las páginas salvo `/login` y `/signup` necesitan sesión, y cada documento y certificado pertenece al usuario que lo creó.

## Cuentas

El inicio de sesión con email y contraseña está siempre disponible. La página `/signup` está abierta: cualquiera que llegue a la web puede crearse una cuenta, así que deja la instancia detrás de tu propia red o de reglas en el proxy si no es lo que quieres.

## El rol de administrador

Un usuario es `admin` global o no lo es. Los administradores ven la sección **Admin** (`/admin`), donde pueden:

- Crear y borrar usuarios, cambiarles el rol o la contraseña y banearlos o desbanearlos (`/admin/users`).
- Revisar las sesiones (`/admin/sessions`).
- Gestionar organizaciones, equipos y API keys.
- Consultar el registro de actividad (`/admin/logs`), cuando Loki está configurado.

La referencia interactiva de la API en `/scalar` es solo para administradores.

## El primer administrador

El backend crea el administrador descrito por `ADMIN_EMAIL`, `ADMIN_PASSWORD` (al menos 8 caracteres) y `ADMIN_NAME` cada vez que arranca, si ese usuario todavía no existe. Es idempotente: reiniciar no duplica la cuenta ni le cambia la contraseña. El instalador rellena estas tres variables por ti.

## Inicio de sesión único (OIDC)

Para añadir un proveedor de identidad corporativo (Keycloak, Authentik, Google o cualquiera compatible con OIDC), registra un cliente en el proveedor y define tres variables:

```bash
OIDC_CLIENT_ID=garabato
OIDC_CLIENT_SECRET=...
OIDC_DISCOVERY_URL=https://keycloak.example.com/realms/acme
```

`OIDC_DISCOVERY_URL` es la URL base del emisor; se le añade `/.well-known/openid-configuration` para descubrir los endpoints. Se piden los scopes `openid`, `profile` y `email`. Permite esta URI de redirección en el proveedor:

```text
https://firma.example.com/api/auth/oauth2/callback/oidc
```

Si falta cualquiera de las tres variables, el inicio de sesión único queda desactivado y la app arranca solo con email y contraseña.

## API keys

Las API keys permiten que scripts y otros servicios llamen a la API como un usuario. Envía una en la cabecera `x-api-key`; la petición actúa como el dueño de la clave.

```bash
curl -H "x-api-key: $GARABATO_KEY" https://firma.example.com/api/v1/document/list
```

Los administradores gestionan las claves en `/admin/api-keys`. La API acepta además un token Bearer, aparte de la cookie de sesión.
