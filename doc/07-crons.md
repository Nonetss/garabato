# Crons

El proyecto trae un planificador de tareas propio que corre **dentro del
backend**. La idea central: **un job de cron es una llamada programada a un
procedimiento de la API**. No hay un sistema aparte de "tareas"; cualquier
procedimiento puede convertirse en una.

## Las piezas

| Pieza | Dónde | Qué hace |
| --- | --- | --- |
| Planificador | `packages/cron` | Dispara los jobs a su hora (con `Bun.cron`, siempre en UTC) y guarda cada ejecución. No sabe nada de oRPC. |
| Descubrimiento | `packages/api/src/v1/cron/discovery.ts` | Recorre el router de v1 y encuentra qué procedimientos se pueden programar y cuáles traen su horario declarado. |
| API de crons | `packages/api/src/v1/cron/` | Crear, editar, pausar, borrar y ejecutar jobs, y consultar su historial. |
| Cableado | `apps/backend/src/cron/` | Une el planificador con la API al arrancar el backend. |
| Interfaz | `apps/frontend/src/features/crons/` | `/crons` (lista) y `/crons/[id]` (detalle e historial en vivo). |

En la base de datos, `cron_job` guarda la definición de cada job y `cron_run`
una fila por cada ejecución.

## Dos tipos de jobs

### Jobs manuales

Un admin los crea desde `/crons`: elige un **handler** (un procedimiento
marcado como programable), rellena un formulario generado a partir del esquema
de entrada de ese procedimiento y le pone una expresión cron. Se pueden
editar, pausar, borrar y ejecutar al momento.

Para que un procedimiento aparezca como handler disponible, se marca en sus
metadatos:

```ts
.meta(openapi({ ... }), cronMeta({ eligible: true }))
```

No hay que registrarlo en ningún otro sitio. `plugins.list` es un ejemplo.

### Jobs declarados en código

Un procedimiento puede fijar su propio horario:

```ts
.meta(openapi({ ... }), cronMeta({ schedule: "* * * * *", name: "…", description: "…" }))
```

`health.check` lo hace (cada minuto). Al arrancar, el backend sincroniza estas
declaraciones con la tabla `cron_job`: crea las que faltan, actualiza las que
cambiaron, desactiva las que tienen una expresión inválida y borra las que ya
no están en el código.

Estos jobs:

- se ejecutan con `{}` como entrada, así que el procedimiento no puede tener
  entrada obligatoria;
- se ejecutan como el **administrador del seed** (`ADMIN_EMAIL`), así que
  pueden llamar a procedimientos protegidos o de admin;
- son **de solo lectura**: en `/crons` aparecen sin controles, y la API
  responde `CONFLICT` si alguien intenta editarlos, pausarlos o borrarlos.

Las dos formas (`eligible` y `schedule`) son excluyentes.

## Cómo se ejecuta un job

1. El planificador decide que toca ejecutar un job.
2. Si el job está asociado a un usuario, se crea una **sesión real** de ese
   usuario solo para esta ejecución, y se revoca al terminar. Así todos los
   middlewares y comprobaciones de permisos ven a ese usuario como quien
   llama: el cron no se salta ninguna autorización.
3. Se llama al procedimiento con `call()` de oRPC, pasando el payload del job
   como entrada.
4. Se guarda el resultado (o el error) en `cron_run` y se calculan la última y
   la siguiente ejecución.

Existe también el builder `cronProcedure` para procedimientos que **solo**
debe poder llamar el planificador: ninguna petición HTTP puede ejecutarlos,
ni siquiera la de un admin.

## Historial en vivo

La página de detalle no consulta periódicamente. Se suscribe a
`cron.watchRuns`, un stream SSE que avisa cada vez que una ejecución de ese job
cambia (empieza, termina bien, falla, se salta). Con cada aviso, la página
vuelve a pedir el job y su historial. Si la conexión se corta, reconecta con
espera creciente.

Los eventos no se guardan: al conectarse, el cliente recibe `subscribed` y
vuelve a cargar los datos para no perderse nada.

## Cosas a tener en cuenta

- **Una sola instancia.** No hay bloqueo distribuido. Si hubiera dos réplicas
  del backend, cada job se ejecutaría dos veces, y los eventos en vivo solo
  llegarían a quien esté conectado a la réplica que lo ejecutó.
- **El nombre de un procedimiento programable es su identidad.** `cron_job`
  guarda la ruta del procedimiento (por ejemplo `plugins.list`). Renombrarlo,
  moverlo o quitarle `eligible` rompe los jobs que lo usan, así que necesita
  una migración de datos.
- **Si el admin del seed no existe**, los jobs declarados en código se
  ejecutan sin usuario y solo funcionan los procedimientos públicos y los
  `cronProcedure`. El arranque lo avisa en los logs.
- **Borrar un job es un borrado lógico** (`deleted_at`): el historial se
  conserva.
