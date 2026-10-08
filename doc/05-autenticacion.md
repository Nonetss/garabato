# Autenticación y permisos

La autenticación la hace [Better Auth](https://www.better-auth.com),
configurado en `packages/auth`. El backend expone sus rutas bajo `/api/auth/*`.

## Formas de iniciar sesión

- **Email y contraseña**, siempre disponible (`/login`, `/signup`).
- **OIDC genérico** (cualquier proveedor compatible: Keycloak, Authentik,
  Google…), activo solo cuando están definidas `OIDC_CLIENT_ID`,
  `OIDC_CLIENT_SECRET` y `OIDC_DISCOVERY_URL`.

## Plugins activos

| Plugin | Qué añade |
| --- | --- |
| `admin()` | El rol global `admin` y la gestión de usuarios: crear, borrar, cambiar rol o contraseña, banear y desbanear. Es lo que usa `/admin/users`. |
| `organization()` | Organizaciones con miembros, invitaciones, equipos y roles con permisos configurables. |
| `apiKey()` | Claves de API. Una petición con cabecera `x-api-key` se trata como una sesión del dueño de la clave. |
| `genericOAuth` | El inicio de sesión OIDC, solo si está configurado. |

`/admin/plugins` muestra los plugins instalados.

## Dos niveles de permisos

1. **Rol global.** Un usuario es `admin` o no. Los admins ven `/admin` y la
   documentación de la API, y pueden llamar a los `adminProcedure`.
2. **Permisos de organización.** Dentro de una organización, cada miembro
   tiene un rol (`owner`, `admin`, `member` o roles personalizados) con
   permisos sobre recursos. Los recursos y acciones se definen en
   `packages/auth/src/permissions.ts`, y los procedimientos los comprueban con
   `permissionProcedure(recurso, acción)` contra la organización activa de la
   sesión. Un admin global pasa siempre.

### El primer administrador

Al arrancar, el backend crea un usuario admin con `ADMIN_EMAIL`,
`ADMIN_PASSWORD` y `ADMIN_NAME` si todavía no existe uno con ese email. Es
idempotente: reiniciar no lo duplica ni le cambia la contraseña.

## Cómo viaja la sesión

- La sesión es una **cookie** `httpOnly`, `secure` y `SameSite=Lax`. Better
  Auth guarda en caché sus datos durante 60 segundos para no consultar la base
  de datos en cada petición.
- El frontend tiene dos clientes de Better Auth:
  - `src/lib/auth-client.ts`, en el navegador, que llama a `/api/auth` en el
    mismo origen.
  - `src/lib/auth-server.ts`, en el servidor de Astro, que llama al backend
    por `BACKEND_URL`.
- Al llamar a la API también vale un token Bearer o una cabecera `x-api-key`.

## El middleware del frontend

`apps/frontend/src/middleware.ts` se ejecuta antes de cada página:

- Deja pasar `/login`, `/signup` y `/logo.svg` sin sesión.
- Si no hay sesión, redirige a `/login`.
- Si no puede consultar la sesión (backend caído), responde 503.
- Si alguien sin rol `admin` entra en `/admin`, lo redirige a `/`.
- Reenvía las cookies de sesión renovadas.
- Registra cada página vista por un usuario con sesión (salvo las precargas)
  para el registro de actividad.

## Protección CSRF

CSRF es el ataque en que otra web hace que tu navegador envíe una petición a
esta app con tu cookie. Se evita con tres capas, sin plugin en el cliente:

1. **`/rpc` nunca acepta `GET`.** Las escrituras exigen `POST`, `PUT`,
   `PATCH` o `DELETE`, y las lecturas `QUERY`, que el navegador no puede
   enviar desde otra web sin pasar un *preflight* de CORS que solo supera el
   origen configurado.
2. **`/api` rechaza navegaciones desde otra web.** Si un `GET` llega como
   navegación de nivel superior desde otro sitio (según las cabeceras
   `Sec-Fetch-*`), se responde 403. Las peticiones sin esas cabeceras (scripts,
   clientes con API key) pasan.
3. **La cookie es `SameSite=Lax`**, así que el navegador no la envía en
   peticiones cross-site con métodos que modifican datos.

Además, todo va por el mismo origen gracias al gateway (o al proxy de
`astro dev`), así que el navegador nunca necesita CORS.

## Protecciones del backend

Los tres manejadores de oRPC (`/rpc`, `/api` y la documentación) comparten
plugins (`apps/backend/src/routers/handler-plugins.ts`):

- Responden 413 si el cuerpo pasa de 1 MiB.
- Responden 400 si el cuerpo intenta contaminar prototipos (`__proto__`,
  `constructor.prototype`).
- Mandan un *ping* cada 5 segundos en los streams SSE, para que Bun no cierre
  la conexión por inactividad.
- Registran cada error de procedimiento una sola vez, con el nivel adecuado.

`/scalar` y `/openapi.json` solo responden a admins.
