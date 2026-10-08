# Typography (`Text`)

Product text goes through the `Text` component (`apps/frontend/src/components/shared/brand/typography.tsx`): a call site picks a semantic role and a tone instead of rebuilding size, weight, tracking, leading and case with Tailwind utilities. Layout (margins, truncation, flex, width) stays local in `className`; the visual language does not.

```tsx
<Text as="h2" variant="label" tone="muted">Miembros</Text>
<Text as="p" variant="meta" tone="muted" className="mt-0.5">{description}</Text>
<Input className={textVariants({ role: "data" })} />
```

## Where the pieces live

- **Tokens**: `--font-size-*`, `--line-height-*` and `--tracking-caps` / `--tracking-eyebrow` in `:root` of `apps/frontend/src/styles/global.css`, and a `--text-<role>` entry per role in its `@theme inline` block. A `text-<role>` utility sets only the size (plus line height for `meta-sm` and `status`).
- **Recipes**: each role's full class list (weight, tracking, leading, case) is `textVariants` in `typography.tsx`, the single source of truth. Read it there instead of copying it.
- **Merging**: `cn()` (`src/lib/utils.ts`, built with `createCn` from the `cn` package) registers the role names as font sizes. Without that, `text-label` next to `text-muted-foreground` is taken as a second text color and dropped. shadcn registry components import `cn` straight from `"cn"`, which lacks the roles: after `shadcn add`, rewrite that import to `@/lib/utils`, and never run `shadcn migrate cn`.

## Choosing a role

| Role | Use for |
|---|---|
| `display` | The page title (`PageHero`) |
| `headline` | Tile and card titles (`SurfaceCard`, collection cards) |
| `title` | Name of a list row, picker result or selected entity, at body size |
| `body` | Default prose |
| `meta` | Secondary copy: descriptions, hints, counts, inline errors (`tone="destructive"`) |
| `meta-sm` | Sentence-case 11px metadata inside dense rows (suggestion details, port annotations) |
| `label` | Micro-caps section and field labels (`dt`, section `h2`, badges such as "Error") |
| `status` | Micro-caps state text ("Vigente", log type); `StatusTag` builds on it and adds the dot |
| `stat` | A single big number in an overview fact cell |
| `data` | Monospace values: cron expressions, ids, IPs, timestamps, JSON, handler keys |
| `compact` | Any other `text-xs` copy: menu item descriptions, dense list secondary lines, dialog/sheet descriptions, footers |

Tones: `default`, `muted`, `primary`, `destructive`. `as` picks the element (`span` by default; `p`, `div`, `label`, `code`, `dt`, `dd`, `h1`–`h4`, `ol`, `li`). Plain `text-sm` copy (row titles, prose inside cards) can stay as utilities; `MetadataCell` values use `body`.

## Rules

- Use `Text` whenever the text sits in a plain element (`span`, `p`, `div`, `code`, `li`, `dt`, `h2`…) whose only props are `className`, `id`, `role`, `title`, `htmlFor`, `aria-*` or `data-*`. Never hand-build `font-medium text-label uppercase tracking-[0.12em]`, `font-mono text-xs tabular-nums` or `text-xs text-muted-foreground`.
- When `Text` can't be the element (a component such as `DialogDescription`, `DropdownMenuLabel`, `Input`, `SelectItem`, `AppLink`, or an element with a `ref`/event handler such as `button`, `summary`, `pre`), put the role on its `className` with `textVariants({ role, tone })`, or `cn(textVariants(...), "<layout>", conditionalTone)` when there is more.
- `className` carries layout plus local tweaks on top of the role (`font-medium leading-tight` on a menu item title, `leading-normal` on a line-clamped description, `font-mono` on an eyebrow). A conditional tone (`isError ? "text-destructive" : "text-muted-foreground"`) goes after `textVariants(...)` in `cn()` so it wins.
- Composed patterns already wrap `Text`; use them instead of rebuilding them: `FieldLabel` (form label tied to a control), `StatusTag` (state word with a dot), `SectionHeading` (micro-caps section title with optional `(n)` count and action), `MenuItemText` (label + two-line description in a rich menu row) and `MetadataCell` (label + value fact).
- `components/ui` primitives keep their own classes, because `ui` can't import `components/shared`; call sites style them through `className={textVariants(...)}`. `.astro` files can't render React without an island, so they keep the utilities.
- **Adding a role** touches three places in the same change: the `--font-size-*` (and, if needed, `--line-height-*`) token plus `--text-<role>` in `global.css`, the role in `textVariants`, and the name in `typeRoles` in `lib/utils.ts`. Update this table too. (Roles built only from stock utilities, such as `title`, `data` and `compact`, have no token and no `typeRoles` entry.)
