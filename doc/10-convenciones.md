# Convenciones

Las reglas normativas están en `AGENTS.md`. Aquí van las que más se notan al
trabajar, con su porqué.

## Idiomas

- **Código en inglés:** identificadores, comentarios, mensajes de log, errores
  internos y las descripciones de OpenAPI.
- **Lo que ve el usuario, en español:** textos de la interfaz y los mensajes de
  error de la API que muestra la interfaz
  (`errors.NOT_FOUND({ message: "Comentario no encontrado" })`).
- **La documentación mantiene su idioma:** `README.md` está en inglés,
  `PRODUCT.md` y esta carpeta en español.

## Estilo de TypeScript

El formato lo decide Biome (2 espacios, comillas dobles, sin punto y coma, 80
columnas). Además hay reglas de estilo que Biome no comprueba. Todas buscan lo
mismo: que lo que el código decide se vea, y que el compilador no deje pasar
errores de tipos.

**No se permite:**

| Patrón | Ejemplo |
| --- | --- |
| Casts que silencian al compilador | `valor as Tipo`, `valor as unknown as Tipo`, `valor!` |
| Tipos genéricos inventados para que algo encaje | `TData = unknown` que nadie necesita |
| Cadenas de `??` | `a ?? b ?? c ?? null` |
| `??` con un valor por defecto que no es literal | `job.description ?? job.cronExpression` |
| Ternarios anidados o dentro de una expresión | `list.flatMap((x) => (x.ok ? [x.id] : []))` |
| Memoizar con `let` + `??=` | `let spec; const get = () => (spec ??= build())` |

**Sí se permite:** un `??` con un literal (`user.name ?? ""`), un ternario
simple como valor de una asignación (`const mode = enabled ? "on" : "off"`) y
el encadenamiento opcional para leer (`user?.role === "admin"`).

**Qué hacer en su lugar:**

- Para un valor que puede ser de otro tipo, **estrecharlo con una
  comprobación** (`if (typeof x === "boolean") return null`), no con `as`.
- Para varios valores por defecto, **una función con nombre y `return`
  tempranos**:

  ```ts
  function jobDescription(job: CronJob): string {
    if (job.description !== null) return job.description
    return job.cronExpression
  }
  ```

- Para filtrar y transformar, `.filter().map()` o un bucle `for`.
- Para objetos que dependen de una condición, dos `return` explícitos.
- Si un tipo no encaja de ninguna forma limpia, se para y se consulta antes
  de escribir un cast.

## Reutilizar antes de crear

Antes de escribir un componente, hook, helper o procedimiento nuevo, se busca
uno que ya exista y se reutiliza o se extiende (ver dónde mirar en
[Frontend](06-frontend.md#antes-de-crear-algo-busca) y en
[Backend y API](04-backend-api.md#añadir-un-procedimiento-paso-a-paso)). Lo
nuevo nace dentro de su feature y se promueve a compartido cuando de verdad se
reutiliza.

## Las funcionalidades de la plantilla

El proyecto trae muchas cosas de serie (admin, organizaciones, API keys, crons,
comentarios, iconos de entidad, registro de actividad…). Que existan no
significa que el producto las necesite:

- No se da por hecho que una tarea requiere una de ellas.
- Tampoco se quitan "para simplificar" sin decidirlo explícitamente.
- Quitar una es un cambio con su propia propuesta de OpenSpec, como se hizo
  con las colecciones (`openspec/changes/archive/2026-10-08-remove-collections/`).

## Migraciones

Las migraciones las genera, revisa y commitea una persona
(`bun run db:generate`). Los agentes de código no las generan, aplican ni
editan, y tampoco cambian el esquema sin que se les pida. Si una tarea necesita
una migración, el agente propone el cambio y se para.

## Procesos y pruebas en vivo

- Nadie (ni agente ni script) mata o reinicia un servidor de desarrollo o el
  stack de Docker que esté corriendo sin preguntar: se asume que está en uso.
- La validación normal es `check-types`, Biome y `bun run test`. Las pruebas
  contra la app en marcha (curl, navegador) se hacen solo cuando se piden,
  porque casi todo requiere sesión.

## Commits

Se sigue Conventional Commits: `tipo(ámbito): resumen corto en imperativo`,
en inglés, en minúsculas y sin punto final.

```txt
feat(frontend): add 404 page
fix(api): use proper HTTP methods on destructive oRPC routes
docs(openspec): archive remove-collections and sync its specs
```

- Tipos habituales: `feat`, `fix`, `refactor`, `chore`, `docs`, `style`.
- El ámbito es el área afectada (`api`, `frontend`, `db`, `docker`,
  `openspec`, `deps`…); si son varias, separadas por comas.
- Un commit por unidad de trabajo coherente; los cambios que no tienen relación
  van en commits separados.
- Nunca se atribuye un commit a una herramienta de IA (ni `Co-Authored-By` ni
  pies del tipo "Generated with…").

## OpenSpec: primero la especificación

Cada capacidad del sistema tiene una spec en
`openspec/specs/<capability>/spec.md` con requisitos (`SHALL`) y escenarios
(`WHEN` / `THEN`). Es la descripción de referencia de cómo debe comportarse.

Un cambio funcional sigue este ciclo:

1. **Proponer:** `openspec new change <nombre>` crea la carpeta del cambio en
   `openspec/changes/<nombre>/`.
2. **Escribir los artefactos:** `proposal.md` (por qué y qué cambia), los
   deltas de specs en `specs/` (requisitos añadidos, modificados o
   eliminados), `design.md` (cómo, con decisiones y riesgos) y `tasks.md`
   (lista de tareas).
3. **Implementar** las tareas, marcándolas como hechas.
4. **Sincronizar** los deltas con las specs principales.
5. **Archivar** el cambio en `openspec/changes/archive/<fecha>-<nombre>/`.

En Claude Code esto se hace con `/opsx:propose`, `/opsx:apply`, `/opsx:sync`
y `/opsx:archive`. Para comprobar que todo está bien formado:

```bash
openspec validate --specs --strict
openspec list --specs
```
