# Frontend feature structure

- Features live under `apps/frontend/src/features/<domain>/`. Every direct child of a domain is a semantic use case (`overview`, `detail`, `sign-in`, etc.), a domain-local `shared/` slice, or the domain's `index.ts`. Never put technical `components/`, `hooks/`, `model/`, `definitions/` or `schemas/` folders beside semantic slices at the domain root.
- Inside a semantic slice, use only the technical folders it needs: `components/` for React views, `definitions/` for static typed presentation descriptors, `hooks/` for React state/effects, `model/` for framework-independent types and transformations, and optional `schemas/` for runtime validation. Do not create empty placeholder folders.
- Route-level React islands are named `*-page.tsx`. Static renderer contracts use `.definition.ts` or `.definition.tsx` (the latter only when JSX is required). Folders/files use kebab-case, components PascalCase and hooks `use*`.
- **A `*-page.tsx` file contains only the page component**: the island boundary that mounts `QueryProvider` (plus `PageShell` when the route needs it) around `<XContent />`. The actual surface — queries, state, dialogs, markup — lives next to it in `*-content.tsx` exporting `XContent` (`crons-page.tsx` + `crons-content.tsx`). Keeps the provider boundary readable and the content reusable on its own.
- Each slice exposes a narrow `index.ts`. Astro routes and other domains import from the owning slice/domain public entry point; cross-slice consumers never reach into another slice's private technical folders. Files inside a slice use direct `@/features/...` internal imports and never their own barrel.
- A domain root `index.ts` exists only when something actually imports the domain (`@/features/crons`, `@/features/profile`). Container domains whose slices are mounted independently (`admin`, `app-shell`, `config`) have no root barrel — don't add a dead one for symmetry.
- When two sibling slices consume each other's APIs, the page-level `index.ts` barrels would form an import cycle. The owning slice then adds a **`public.ts`** next to `index.ts` holding the cycle-free API (types, query/search hooks, no route page); its own `index.ts` re-exports that file, and the sibling slice imports `@/features/<domain>/<slice>/public`. See `features/admin/organizations/public.ts` ↔ `features/admin/teams/public.ts`. Use it only to break a real cycle — `index.ts` stays the default entry point.
- A domain-local `shared/` owns code used by at least two slices in that domain. Code shared by unrelated domains belongs in `components/shared`, `hooks`, `lib` or another intentional application owner. Promote a visual pattern to `components/shared` after at least three production consumers share the same intent, except for cross-cutting correctness boundaries such as accessible navigation or provider ownership; visual resemblance alone is insufficient.
- `components/ui` contains product-agnostic primitives (shadcn `base-nova` on Base UI) and imports neither `components/shared` nor `features`. `components/shared` contains reusable application patterns and never imports `features`; its domains are `brand`, `data-display`, `feedback`, `form`, `layout`, `navigation`, `resource` and `user`.
- Runtime providers live in `apps/frontend/src/providers` (`query-provider.tsx`) and are mounted at application/island/page boundaries, not hidden inside visual layout components.
- Frontend-internal imports use the `@/` absolute alias, not relative paths.
- Any React component mounted from an `.astro` file uses `client:only="react"`, never `client:load` (or other `client:*` directives) — this repo skips SSR-then-hydrate for React islands entirely.
- UI copy is Spanish; identifiers and comments are English.

## Before writing a component, hook or helper

Search the codebase first, and reuse or extend what exists. Look, in this order:

| Need | Where to look |
|---|---|
| A visual primitive (button, dialog, popover, select, sidebar, tooltip, card…) | `src/components/ui/` (one file per primitive). Missing there? Check the shadcn registry for the `base-nova` style before hand-building one; after `shadcn add`, rewrite its `cn` import to `@/lib/utils` (`typography.md`). |
| An application pattern (page hero and shell, list rows, filters, metadata grids, status tags, row action menus, copy button, search input, entity picker, segmented picker, number stepper, avatar…) | `src/components/shared/<domain>/` — `brand`, `data-display`, `feedback`, `form`, `layout`, `navigation`, `resource`, `user`. |
| Something a feature already built | The owning domain under `src/features/<domain>/`, through its slice's `index.ts` (or `public.ts`). If a second domain needs it, promote it rather than copy it. |
| A React hook (hydrated queries, infinite scroll, dialog/form state, oRPC mutations, debounced values, query params, clipboard, scroll…) | `src/hooks/` (`use-*.ts`). |
| A client-side helper (oRPC client and query utils, auth clients, formatting, folding text for search, toasts, navigation, theme, route identity) | `src/lib/`. |

`rg -il "<keyword>" apps/frontend/src/components apps/frontend/src/hooks apps/frontend/src/lib` with a few words of the need (in English and Spanish, since UI copy is Spanish) finds most candidates; read the candidate's source and one of its callers before relying on it. A new piece starts in its feature slice even when it looks reusable, and is promoted on real reuse.
