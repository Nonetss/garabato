# Documentación de stack

Esta carpeta explica cómo funciona el proyecto por dentro, pensada para leerse
de principio a fin o por partes. El `README.md` de la raíz es el resumen rápido
(qué es y cómo arrancarlo). Aquí está el porqué de cada pieza y cómo se trabaja
con ella.

Las reglas que deben seguir los agentes de código están en `AGENTS.md` y en la
skill `.agents/skills/stack/`. Estos documentos cuentan lo mismo con más
contexto y menos jerga. Si alguna vez no coinciden, mandan las specs de
`openspec/specs/` y el código.

## Índice

1. [Arquitectura](01-arquitectura.md): las piezas del sistema y el camino de una petición.
2. [Desarrollo local](02-desarrollo.md): arrancar el proyecto, comandos del día a día, base de datos y validación.
3. [Configuración](03-configuracion.md): el único `.env`, quién lo lee y qué significa cada variable.
4. [Backend y API](04-backend-api.md): cómo está organizado `packages/api`, cómo se añade un procedimiento, métodos HTTP y errores.
5. [Autenticación y permisos](05-autenticacion.md): Better Auth, sesiones, roles, organizaciones, API keys y CSRF.
6. [Frontend](06-frontend.md): estructura de features, componentes, navegación, layouts y sistema visual.
7. [Crons](07-crons.md): el planificador de tareas y cómo convertir un procedimiento en un job.
8. [Funcionalidades transversales](08-transversales.md): comentarios, iconos de entidad y registro de actividad.
9. [Docker y despliegue](09-docker-despliegue.md): los cuatro compose, las imágenes, el CI y el instalador.
10. [Convenciones](10-convenciones.md): estilo de código, idiomas, commits, migraciones y el flujo de OpenSpec.

## Diagramas

Los diagramas están en `diagrams/` como SVG, con las fuentes del proyecto
incrustadas para que se vean igual en cualquier visor. Usan el mismo sistema
visual que el frontend: los colores son los tokens de
`apps/frontend/src/styles/global.css` (fondo, texto, `card`, bordes y el
naranja `primary` como único acento), las etiquetas siguen el rol `label` de
`Text` y cambian a modo oscuro con el sistema.

Cada SVG tiene al lado su `.html`, que es el original: se edita el HTML y se
vuelve a generar el SVG. Los colores van como `var(--token)` en atributos
`style`, nunca en hexadecimal, y el SVG exportado tiene que conservar el bloque
de tokens (claro y oscuro) y las fuentes incrustadas. La exportación estándar
de la skill `diagram-design` no lo hace, así que hay que revisar el resultado.

`architecture.svg` es la versión en inglés de `arquitectura.svg` para el
`README.md` de la raíz, con más detalle (las rutas que el gateway envía al
backend, `/health`, `BACKEND_URL` y los paquetes que corre el backend). Si
cambia una, hay que cambiar la otra.

`project-structure.svg` dibuja el árbol de "Project Structure" del
`README.md` de la raíz. Si cambia ese bloque, hay que cambiar el diagrama.

## Glosario rápido

| Término | Qué es |
| --- | --- |
| **Workspace** | Cada carpeta de `apps/*` y `packages/*` con su propio `package.json`. Bun las enlaza entre sí. |
| **Procedimiento** | Una operación de la API (por ejemplo `cron.list`). Se define una vez y se puede llamar por RPC o por HTTP. |
| **Feature (API)** | Un grupo de procedimientos relacionados (`cron`, `comment`…), en su carpeta `packages/api/src/v1/<feature>/`. |
| **Feature (frontend)** | Un dominio de la interfaz (`crons`, `admin`…) en `apps/frontend/src/features/<dominio>/`. |
| **Slice** | Un caso de uso dentro de un dominio del frontend (`overview`, `detail`…). |
| **Superficie** | Cualquier página con identidad propia (título, etiqueta, icono). Se declaran en `app-surfaces.ts`. |
| **Isla** | Un componente React montado dentro de una página Astro. |
| **Capability (OpenSpec)** | Un área funcional documentada con requisitos en `openspec/specs/<capability>/spec.md`. |
