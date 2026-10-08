---
name: stack
description: A quiet-editorial technical console on monochrome paper with one warm accent.
colors:
  primary: "oklch(0.6724 0.1308 38.7559)"
  neutral-bg: "oklch(0.9818 0.0054 95.0986)"
  neutral-fg: "oklch(0.3438 0.0269 95.7226)"
  neutral-muted: "oklch(0.5341 0.0078 97.4503)"
  neutral-card: "oklch(0.9665 0.0067 97.3521)"
  neutral-card-fg: "oklch(0.1908 0.002 106.5859)"
  neutral-border: "oklch(0.94 0.003 97.3627)"
  neutral-input: "oklch(0.92 0.004 98.3528)"
  desk: "oklch(0.9665 0.0067 97.3521)"   # `bg-desk`: the surface a PDF sheet rests on (dark: oklch(0.2213 0.0038 106.707))
  destructive: "oklch(0.1908 0.002 106.5859)"
  destructive-fg: "oklch(1 0 0)"
  dark-bg: "oklch(0.2679 0.0036 106.6427)"
  dark-fg: "oklch(0.9576 0.0027 106.4494)"
  dark-muted: "oklch(0.7713 0.0169 99.0657)"
  dark-card: "oklch(0.2928 0.0018 106.5092)"
  dark-border: "oklch(0.31 0.004 106.8928)"
  dark-input: "oklch(0.34 0.005 100.2195)"
  dark-destructive: "oklch(0.6368 0.2078 25.3313)"
typography:
  sans:
    fontFamily: "Schibsted Grotesk Variable, Schibsted Grotesk, Schibsted Grotesk Fallback, sans-serif"
  mono:
    fontFamily: "JetBrains Mono Variable, JetBrains Mono, JetBrains Mono Fallback, ui-monospace, monospace"
  display:
    fontFamily: "Schibsted Grotesk Variable, Schibsted Grotesk, Schibsted Grotesk Fallback, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Schibsted Grotesk Variable, Schibsted Grotesk, Schibsted Grotesk Fallback, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Schibsted Grotesk Variable, Schibsted Grotesk, Schibsted Grotesk Fallback, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Schibsted Grotesk Variable, Schibsted Grotesk, Schibsted Grotesk Fallback, sans-serif"
    fontSize: "0.875rem"
    lineHeight: 1.5
  meta:
    fontFamily: "Schibsted Grotesk Variable, Schibsted Grotesk, Schibsted Grotesk Fallback, sans-serif"
    fontSize: "0.8125rem"
    lineHeight: 1.625
  stat:
    fontFamily: "Schibsted Grotesk Variable, Schibsted Grotesk, Schibsted Grotesk Fallback, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  label:
    fontFamily: "Schibsted Grotesk Variable, Schibsted Grotesk, Schibsted Grotesk Fallback, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 500
    letterSpacing: "0.12em"
    textCase: "uppercase"
rounded:
  sm: "calc(0.25rem - 4px)"    # 0px
  md: "calc(0.25rem - 2px)"    # 2px
  lg: "0.25rem"                # 4px (radius base) — near-square sheets
  xl: "calc(0.25rem + 4px)"    # 8px
  container: "0.75rem"          # 12px — list containers, state cards
spacing:
  px: "0.25rem"                # Tailwind 1 unit
  gap-section: "1.5rem"        # gap-6 between header and content
  padding-page: "1.5rem"       # py-6
  padding-shell: "1rem"        # px-4 on mobile
  stagger-row: "40ms"          # --dash-delay between list rows
components:
  page-shell-default:
    padding: "{spacing.padding-page}"
    maxWidth: "72rem"          # 6xl — list/overview pages
  page-shell-full:
    padding: "{spacing.padding-page}"
    maxWidth: "none"           # full — wide tables or canvases on desktop
  page-shell-profile:
    padding: "{spacing.padding-page}"
    maxWidth: "56rem"          # 4xl — /me only (not detail routes)
  page-hero-title:
    typography: "{typography.display}"
  section-nav-tile:
    backgroundColor: "oklch(0.9665 0.0067 97.3521 / 0.4)"  # bg-card/40
    borderRadius: "{rounded.container}"
    padding: "1.25rem"
  row-list-container:
    backgroundColor: "oklch(0.9665 0.0067 97.3521 / 0.4)"  # bg-card/40
    borderRadius: "{rounded.container}"
    borderColor: "{colors.neutral-border}"
  state-card-default:
    backgroundColor: "oklch(0.9665 0.0067 97.3521 / 0.4)"  # bg-card/40
    borderRadius: "{rounded.container}"
    padding: "4rem 1.5rem"
  form-dialog-header:
    borderColor: "{colors.neutral-border}"
    padding: "1.25rem 1.5rem"
    typography: "{typography.headline}"
  field-label:
    typography: "{typography.label}"
    textColor: "oklch(0.5341 0.0078 97.4503)"              # muted-foreground, full opacity (4.92:1 light / 7.36:1 dark — /80 failed WCAG AA at 3.33:1)
  section-heading:
    typography: "{typography.label}"
    textColor: "{colors.neutral-muted}"
  hint:
    backgroundColor: "{colors.neutral-fg}"
    textColor: "{colors.neutral-bg}"
    rounded: "{rounded.md}"
    padding: "0.375rem 0.75rem"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "oklch(1 0 0)"  # --primary-foreground
    rounded: "{rounded.md}"
  filter-chip:
    textColor: "{colors.neutral-fg}"
    rounded: "{rounded.md}"
    height: "1.75rem"          # h-7
    padding: "0 0.25rem 0 0.625rem"
  filter-chip-exclude:
    textColor: "{colors.destructive}"
    rounded: "{rounded.md}"
    height: "1.75rem"
  segmented-option:
    textColor: "{colors.neutral-muted}"
    rounded: "{rounded.md}"
    height: "2rem"             # h-8
  segmented-option-selected:
    backgroundColor: "{colors.neutral-fg}"
    textColor: "{colors.neutral-bg}"
    rounded: "{rounded.md}"
    height: "2rem"
  list-action-bar:
    backgroundColor: "oklch(0.9818 0.0054 95.0986 / 0.95)"  # bg-background/95
    padding: "0.75rem 1rem"
  list-action-bar-button:
    height: "2.75rem"          # h-11, 44px touch target
    rounded: "{rounded.md}"
  scroll-to-top:
    backgroundColor: "{colors.primary}"
    textColor: "oklch(1 0 0)"
    size: "2.75rem"            # size-11 mobile, size-9 on md+
    rounded: "9999px"
---

# Design System: stack

## Overview

**Creative North Star: "El Espacio de Trabajo Sereno."**

stack is a quiet-editorial technical console. Every page reads like a watchmaker's catalogue page or a typeset datasheet: a single primary hero, a facts strip or list, and a state column — never a wall of cards. The personality is **typography-first, monochrome-by-default, one-accent-by-policy**: hierarchy comes from size, weight, tracking, and tabular numerals, not from a rainbow of semantic colors. The single warm accent (Brand Terracotta) is reserved for the hero icon, the primary CTA, and the "alive" state dot. Everything else is the foreground/muted-foreground/border vocabulary of a printed page.

Density is calm rather than compact. Containers are flat by default (no shadows, no glows); depth comes from `border-y` rules, `divide-y` lists, and one optional `rounded-xl border bg-card/40` for navigation tiles or state blocks. Motion is short and useful: a 0.3s staggered entrance (`dash-enter`, ~40ms per item) and a 0.25s pop (`dash-pop`) for nested icons. The whole product lives in a `6xl` rhythm, framed by `PageShell` for list/overview pages and by `Detail.astro`'s own frame for detail routes, always headed by `PageHero`. Anti-references: "shadcn by default with badge primary + badge outline + icon box primary/15", and any surface that uses cards where a `divide-y` list would do.

**The Marginalia Rule.** Every screen must pass this test: if the design "shows up" because it adds color, a card, a glow, or a chip cluster, it is almost certainly out of style. It earns notice by making the eye land on the name, the expression, and the state — not on the chrome.

**Key Characteristics:**

- Monochrome page; one warm accent reserved for three jobs.
- Hierarchy lives in type, not color.
- Lists are `divide-y`, not free-floating cards.
- Hairlines (`border-y`, `divide-y`, dialog `border-b`/`border-t`) carry structure.
- Motion is staggered entrance + pop, never decorative.

## Colors

The palette is a single neutral ramp (paper → ink → mute → border) plus one warm accent for brand voice and one destructive ramp for irreversible failure. No semantic colors are invented for success/info/warning — state is communicated with type and dots, not pills.

### Primary

- **Brand Terracotta** (`oklch(0.6724 0.1308 38.7559)`): warm, between vermilion and ochre, calibrated for daylight paper. Reserved exclusively for (a) the hero icon at `size-5`, (b) the primary CTA button, and (c) the "active / running" state dot. Aliases: `--brand-orange`, `--primary`, `--ring`, `--sidebar-primary`, `--chart-1`.

### Tertiary (Destructive)

- **Editorial Ink** (`oklch(0.1908 0.002 106.5859)`, light theme destructive): reads as near-black. Sole use: errors, deletions, a missing handler, an irreversible action. Paired text color is white (`oklch(1 0 0)`). In dark mode the destructive ramp shifts to a true red (`oklch(0.6368 0.2078 25.3313)`) only because `oklch` ink-on-paper invert is otherwise too quiet in dark.

### Neutral

- **Paper** (`oklch(0.9818 0.0054 95.0986)`): page background — `--background`.
- **Ink** (`oklch(0.3438 0.0269 95.7226)`): body text — `--foreground`.
- **Mute** (`oklch(0.5341 0.0078 97.4503)`): secondary text, descriptions, dates, hints — `--muted-foreground`.
- **Card** (`oklch(0.9665 0.0067 97.3521)`, used at 40% opacity via `bg-card/40`): the surface tint for list rows, navigation tiles, and state blocks.
- **Card Ink** (`oklch(0.1908 0.002 106.5859)`): high-contrast text on cards.
- **Border** (`oklch(0.94 0.003 97.3627)`): all hairlines — list dividers, dialog headers/footers, fact rows, tile borders.
- **Input** (`oklch(0.92 0.004 98.3528)`): the resting line of text inputs.

Dark theme mirrors the same roles with a slightly warm dark surface (`oklch(0.2679 0.0036 106.6427)` foreground #957 / mute #771 / card #292 / border #31) and the accent stays Brand Terracotta — the warm accent survives the inversion.

### Named Rules

**The One Accent Rule.** Brand Terracotta appears on ≤ 3 elements per screen: hero icon, primary CTA, alive-state dot. It is **never** used for badges, success indicators, info, or warning. Its rarity is the point. The one standing exception is the floating back-to-top control (see Components → Scroll-to-top), which only exists once the page has scrolled well past the hero, so the two never share a viewport in practice.

**The No-Green-No-Blue-No-Amber Rule.** Inventing semantic colors for success/info/warning is prohibited. Success is communicated by a `bg-foreground` dot and the word "ok"; failure is the destructive ramp above; everything else is mute.

## Typography

**Display / Sans:** Schibsted Grotesk Variable (`@fontsource-variable/schibsted-grotesk`), `font-sans`.
**Body:** Schibsted Grotesk Variable — same family as display, sized down.
**Mono:** JetBrains Mono Variable (`@fontsource-variable/jetbrains-mono`, `font-mono`), reserved for fingerprints, serials, IDs, durations, cron strings and any value that needs `tabular-nums`. Never the default for UI copy. Both faces ship one variable `wght` file, preloaded in `layouts/font-preload.astro`. Each stack carries a metric-matched local fallback (`Schibsted Grotesk Fallback` over Arial / Liberation Sans, `JetBrains Mono Fallback` over Menlo / Liberation Mono / Courier New, declared with `size-adjust` and ascent/descent overrides at the top of `global.css`) so the `font-display: swap` moment doesn't reflow lines. They are not a third face: they only stand in until the woff2 arrives. Mono text never renders JetBrains' code ligatures (`font-variant-ligatures: none` on `.font-mono`, `code`, `kbd`, `samp`, `pre`): data is read character by character.

**Character.** A grotesk cut for printed paper (Schibsted) for prose, paired with a clear monospace for technical values. Garabato is a sheet and a pen: the type reads like a well-set form, the signature is the only hand-drawn thing. There is no third face — no serif display, no system fallback masquerading as a choice.

### Hierarchy

Every role below is a `variant` of the `Text` component (`components/shared/brand/typography.tsx`), which owns its full recipe on top of the `--font-size-*` / `--line-height-*` / `--tracking-*` tokens in `global.css`. Call sites pick a role and a tone (`default`, `muted`, `primary`, `destructive`) and keep only layout in `className`; components that can't be a `Text` (shadcn primitives, `button`, `summary`, `Input`) take the same classes through `textVariants({ role, tone })`.

- **Display** (`font-semibold`, `1.5rem`, `tracking-tight`, `line-height: 1.15`): page title in `PageHero`, used on both overview and detail pages. Single line, never eyebrowed.
- **Headline** (`font-medium`, `text-base`, `tracking-tight`): tile and card titles (`SurfaceCard`, a certificate sheet, the signing panel on a document), a profile name, a `StateCard` title, and every dialog and sheet title — `DialogTitle` and `SheetTitle` carry this recipe by default, so call sites pass no type classes.
- **Title** (`font-medium`, `text-sm`, `tracking-tight`): the name of a list row, a picker result or a selected entity — the body-size counterpart to Headline.
- **Body** (`text-sm`, `line-height: 1.5`): prose, form values, fact values inside `MetadataCell`.
- **Meta** (`0.8125rem`, `leading-relaxed`): secondary copy — descriptions, hints, hero counters, inline errors.
- **Meta-sm** (`0.6875rem`, sentence case): inline metadata inside dense rows (suggestion details).
- **Label** (micro-caps, `0.6875rem`, `font-medium`, `uppercase`, `0.12em` tracking, `muted-foreground` at full opacity): the recurring field label in fact rows, form fields, filters, section headings and tile subaccess. This is the signature detail that ties the whole system together. Full opacity, not `/80` — the faded version fails WCAG AA contrast (3.33:1 light mode).
- **Status** (`text-xs`, `uppercase`, `0.08em` tracking): state words ("Vigente", "En pausa"); `StatusTag` adds the dot.
- **Stat** (`1.5rem`, `font-medium`, `tabular-nums`, `line-height: 1.1`): a single big number in an overview fact cell.
- **Data** (`JetBrains Mono`, `text-xs`, `tabular-nums`, `tracking-tight`): any technical value — cron expressions, durations, ISO timestamps, IDs, keys, JSON.
- **Compact** (`text-xs`): any other dense copy — menu descriptions, secondary row lines, dialog and sheet descriptions, footers.

### Named Rules

**The Tabular-Nums Rule.** Any column or list of values rendered with `font-mono` must include `tabular-nums` so digits line up. Default Tailwind doesn't apply it; add it on every mono block that aligns.

**The Label-Not-Badge Rule.** Field labels, counts, and statuses are typeset as **micro-caps text**, not as `Badge` components. If a value can be expressed as `<FieldLabel/>` it must be.

**The Section-Heading Rule.** One level below the page title, a section is named by `SectionHeading` (the `label` role, with an optional `(n)` count) — never by a `title`-role heading, which is the size and weight of the row names under it. A section that is itself a card (`rounded-xl border bg-card/40`) takes a `headline` title instead.

**Wrapping and dark compensation.** Headings (`h1`–`h4`) balance their lines and prose (`p`, `li`, `dd`, `figcaption`) avoids a lone last word, from the base layer of `global.css`. In the dark theme `--tracking-normal` rises to `0.01em`; the whole `--tracking-*` ramp derives from it, so light-on-dark text gets the same hair of extra air everywhere.

**The Role-Not-Utility Rule.** Text is set through a `Text` role, never by rebuilding `font-medium text-label uppercase tracking-[0.12em]` or `text-xs text-muted-foreground` at the call site. A new recurring type style becomes a new role (token in `global.css`, recipe in `textVariants`, name registered in `cn()`), not a copied class string.

## Layout

Almost every list/overview page (`/`, `/admin` and its subsections) sits in `PageShell maxWidth="6xl"` (72rem), `px-4 py-6 sm:px-6` padding; `/crons` uses `maxWidth="80%"` (full width below `lg`, capped at 80% from `lg`). **Detail routes** (`/crons/[id]`) don't use `PageShell` at all: the `Detail.astro` layout owns its own `px-4 py-6 sm:px-6` `<main>` plus the back link, with a `maxWidth` prop (`6xl` by default, `80%` to match an `80%` overview), and the mounted feature island renders `PageHero` directly inside it — wrapped in a bare `QueryProvider`, never a second `PageShell` (that would nest a second `<main>`). Detail pages take the same width as their overview, not narrower (`/crons/[id]` passes `maxWidth="80%"`); the only current `4xl` user is `/me` (a single-column profile form, not the general detail pattern), and `3xl` is a defined `PageShell` option with no current caller. Whichever wrapper is in play, the inner `.astro` file never adds a second `<main class="container…">`.

Vertical rhythm is `gap-6` between the header (`PageHero`) and the content block, `gap-2.5` between the hero icon column and the title, `gap-4` between sibling sections in a dialog body, and `gap-5` (`py-5`) inside a fact row. Lists in single-column on mobile expand to `sm:grid-cols-3 lg:grid-cols-5` for facts and `md:grid-cols-2 xl:grid-cols-3` for section-nav tiles. Spacing is on the 0.25rem Tailwind unit; nothing is invented outside the existing scale.

Sticky chrome is reserved for `Navbar` (height `--navbar-height: 3.6rem` ≈ h-14) and `Footer` (`--footer-height: 13rem` stacked on mobile, `7.6rem` single-row on `sm+`). The layout utility `min-h-main` fills the remaining vertical space without hardcoding heights.

**Below `md` (768px), list pages gain bottom chrome.** Filters leave the inline panel and move to a fixed bottom `ListActionBar` (`border-t`, `bg-background/95 backdrop-blur-sm`, `px-4 pt-3`, bottom padding `0.75rem + env(safe-area-inset-bottom)`). It slides away (`translate-y-full`, 200ms ease-out) on scroll down and returns on scroll up, so it never covers what is being read. While visible it publishes `--list-action-bar-offset` (4.25rem) on `:root`; the floating back-to-top control adds that offset to its `bottom` so the two never overlap, and drops back to the corner when the bar hides. Every fixed bottom element respects the safe-area insets; touch targets on this chrome are 44px (`h-11` / `size-11`).

## Elevation & Depth

**Flat by default. Borders carry structure.** Shadows are present in the token system (`--shadow-sm` … `--shadow-2xl`) because shadcn/ui requires them, but they are not the design's vocabulary. A list row is `border-y` on the container with `divide-y` between rows, never a card with `shadow-md`. A state block is `rounded-xl border border-dashed bg-card/40`, never a card with `shadow-lg`.

**The Flat-By-Default Rule.** Surfaces are flat at rest. Shadows appear only as a response to state (focus ring, dialog overlay, dropdown menus) and use the small Tailwind/Shadcn ramp. Decorative `shadow-md` / `shadow-lg` / `shadow-xl` on rows, tiles, or heroes is out of style.

**The Floating-Layer Exception.** Elements that float over scrolling content — the fixed `ListActionBar` and the back-to-top control — need to read as detached from the page beneath them. The bar does it with a hairline `border-t` over a 95% translucent, blurred background (the same recipe as the navbar); the back-to-top button carries the system's only resting `shadow-lg`, because a round control hovering over arbitrary content has no hairline to lean on. Nothing anchored in the page flow inherits this.

Depth instead comes from:

1. **Hairlines.** `divide-y` between rows, `border-y` on fact blocks, `border-b` + `border-t` on dialog header/footer.
2. **Tonal layering.** `bg-card/40` (40% opacity over `card`) for list containers and state blocks — quieter than a card, more present than the page.
3. **Dashed state.** Empty/error/loading states use `border-dashed` to read as a placeholder, not a container.
4. **Focus ring.** `ring-2 ring-ring ring-offset-2 ring-offset-background` on keyboard focus only — never a permanent decoration.

## Shapes

The form language is restrained. Containers and list rows use `rounded-xl` (12px) — corners are visible enough to read as a "block" without screaming for attention. Inline controls (button, input) use the smaller `--radius` step (base 6px, the project's `--radius: 0.375rem`) — buttons end up ~4px, inputs the same. Tiles (`SectionNavCard`, hub grids) inherit the 12px corner so they feel like cards of paper, not sticky notes.

Borders are full hairline width (1px). `border-dashed` is reserved for empty/error/loading blocks. `border-solid` is reclaimed for the success/celebrate variant of `StateCard`.

There is no decorative clipping (no blob masks, no wave dividers, no svg ornaments).

## Components

The shared primitives — `PageShell`, `PageHero`, `StateCard`, `FormDialog`, `FormField`/`FieldLabel`, `CollapsibleFilters`/`FilterField`, `SearchInput`, `SectionNavOverview` — are the system, plus the `Detail.astro` layout that frames detail routes server-side. shadcn/ui (`components/ui/**`) provides the building blocks (Button, Input, Dialog primitives, etc.) but the editorial chrome always lives in `shared/`.

### Shared vs. feature-internal extraction

Two different problems look similar and are not: a pattern repeated across
features, and a single large file that would read better split up. Only the
first belongs in `components/shared/`.

- **The three-use rule.** A pattern becomes a new public component in
  `components/shared/` only once at least three production call sites need
  the same intent and layout responsibility — not merely a visual
  resemblance. Two similar-looking uses stay local until a third confirms the
  shared intent, unless the code is a necessary subcomponent of an
  abstraction that already cleared the threshold (e.g. a row renderer that
  only exists inside an already-shared list component).
- **Feature-internal decomposition is not shared extraction.** A large file
  with several focused responsibilities but no equivalent use elsewhere (the
  cron run timeline, organization detail sections) gets split into
  feature-owned files under its semantic slice, such as
  `features/crons/detail/components/`, and imported through `@/` — never moved
  into application `components/shared/`. Code used by two slices of one domain
  belongs in `features/<domain>/shared`; these internal components don't gain
  generic props or configuration options to "future-proof"
  them and stay shaped for their actual callers.
- **A shared component owns the structure it promises.** Once something is
  shared, callers pass typed data and behavior, not structural JSX that
  reimplements what the component already owns (e.g. authoring a second
  `<dd>` inside a `MetadataCell`, or hand-building `ul`/`li` markup a list
  component already emits). If a shared component needs a genuinely custom
  leaf — a rich value, a one-off control — it takes a narrow typed render
  callback for that leaf only, never an unrestricted `children` escape hatch
  that lets a caller rebuild the owned layout.
- **Compatibility during migration.** When a shared replacement lands for an
  existing hand-built pattern, the old projection/children mode can stay
  available until every consumer has moved. Delete it only after a static
  search (`rg`) confirms no remaining caller — don't carry two valid ways to
  build the same kind of page indefinitely.

### Feature organization

Feature roots describe product use cases, not implementation layers. For
example, the cron domain contains `overview/`, `detail/` and `shared/`; each
use-case slice owns any `components/`, `definitions/`, `hooks/` or `model/`
folders it actually needs. Route islands use the `*-page.tsx` suffix and Astro
routes import them through narrow slice or domain `index.ts` entry points.
Cross-slice imports use the target slice's public API, while files within the
same slice import direct internal paths to avoid barrel cycles. Runtime React
providers live under `src/providers/` and wrap the island/page boundary rather
than being embedded in `PageShell` or another visual component.

### Resource Composition APIs

The declarative layer that every list/detail overview page is built from —
descriptors and typed slots, not hand-built page structure. A migrated page
supplies data, callbacks and descriptors; these components own layout,
spacing, and the loading/error/empty cascade.

- **App Surfaces (`lib/app-surfaces.ts`).** The single registry of page
  identity: one `AppSurface` per `SurfaceId` (`id`, `path`, `title`, `label`,
  `description`, `icon`, optional `subItems`/`adminOnly`/`nav`). Every page's
  `<title>`, every `PageHero`'s icon/title/description, every nav entry
  (navbar, sidebar, section overview) and every `SurfaceCard` read from this
  one place — `site-nav.ts` is derived from it, not a second source of truth.
  Adding a page means adding one entry here, never hardcoding a label/icon/
  description at the call site.
- **Resource Overview (`ResourceOverview`).** The outer stack for a list/
  overview page: `PageShell` + registry-driven `PageHero` (via `surface`) +
  optional `filters` slot + the query loading/error/empty/filtered-empty
  cascade (`QueryState` underneath). Named slots only (`heroMeta`,
  `heroStatus`, `heroAction`, `heroChildren`, `filters`) — `children` is
  strictly the query-success renderer, never a place to rebuild the shell.
- **Entity List (`EntityList` + `EntityListDefinition`).** The row-rendering
  contract for a resource list: `getPrimary`/`getSecondary`, `getStatus`
  (state dot + micro-caps label), optional `metadata` fact columns,
  `actions` (label/icon/destructive/disabled/hidden, all callback-driven),
  `getOpenHref`/`onOpen`. One `<T, TContext>` definition per resource; a page
  supplies `context` for cross-cutting concerns (current user, lookup maps)
  instead of closing over page state inside the row. A page whose row shape
  doesn't fit this contract (a custom expandable disclosure row, a
  non-uniform layout) renders its own row inside `ResourceOverview`'s
  `children` instead of forcing an ill-fitting `EntityListDefinition`.
- **Resource Filters (`ResourceFilters` + `ResourceFilterDescriptor`).** The
  `CollapsibleFilters` panel driven by typed descriptors instead of
  hand-wired controls: `kind: "search" | "suggestion" | "select" | "date" |
  "facet" | "custom"`. `"facet"` is a multi-value include/exclude filter
  over a known option set, edited through a popover on `md+` and as a
  confirm-to-apply draft in the mobile sheet. `"suggestion"` pairs a text input with fold-text-matched
  suggestions (`lib/fold-text.ts`'s `textSuggestions`) for small in-memory
  collections; `"custom"` escapes to a caller-rendered control (e.g. an
  `EntityPicker`-based filter) when no built-in kind fits. The caller always
  owns filter state and passes `activeCount`/`onClear` — the panel itself
  holds no state. The same descriptors drive both layouts: at `md+` they
  render inside `CollapsibleFilters` and apply live; below `md` they render
  in `ListActionBar` + `FilterSheet` (see below). A page never builds the two
  layouts by hand.
- **Dialog Fields (`DialogFields` + `DialogFieldDescriptor` +
  `useDialogForm`).** The declarative counterpart to `FormField`/`FieldLabel`
  for `FormDialog` bodies: `kind: "text" | "email" | "password" | "textarea"
  | "select" | "checkbox"`, each bound to a `useDialogForm` instance so value/
  onChange/error/`aria-invalid` are never wired by hand. `useDialogForm`
  additionally exposes `errors`/`setError`/`clearErrors` for server-side
  validation replies. A dialog with genuinely one-off field behavior (a
  multi-step wizard, a live schedule preview) stays a hand-built `FormDialog`
  body — the descriptor API is for the common case, not a mandate.
- **Entity Picker (`EntityPicker`).** The single-select searchable picker
  built on a `useSearchSuggestions`-shaped hook (debounced server search) —
  the shared building block behind every "assign a user/org/team" control.
  Renders through `SearchSuggestionsList`; never a hand-rolled `Command`/
  `Popover` reimplementation of the same interaction.
- **Escape-hatch rules.** A few internal type-unsafe casts exist because
  TypeScript can't narrow a descriptor union's generic key back to its
  specific value type at the call site (`resolveIconRef`'s `IconRef`
  resolution, `dialog-fields.tsx`'s `asFieldValue`). These stay: (1) private
  to the component that needs them, never exported; (2) narrow — one cast at
  the exact point genericness defeats inference, not a broad `as any`; (3)
  commented with *why* the cast is safe. They are not a pattern to reach for
  elsewhere — a new one should be treated as a signal to reconsider the
  type design first.

### Page Shell

- **Shape:** rounded none — it's a frame, not a container. Vertical `min-h-main` flex child of the body.
- **Padding:** `px-4 py-6 sm:px-6` (page), `px-3 py-3 sm:px-6 sm:py-6` (compact for tables).
- **Max-width:** `6xl` for essentially every list/overview page; `80%` (`lg:max-w-[80%]`, full width below `lg`) on `/crons`; `full` (`max-w-none`) is a declared option for pages whose content is a wide table or canvas that should fill the sidebar inset on desktop; `4xl` currently only on `/me`; `3xl` is a declared option with no current caller. Centred with `mx-auto`. Detail routes skip `PageShell` entirely (see `Detail.astro` below).
- **Wraps:** `QueryProvider` for TanStack Query. Pages with their own layout or that already sit inside another `<main>` skip it.

### Page Hero

- **Shape:** flat, no border. `gap-4` vertical, `gap-2.5` between icon and title.
- **Icon:** `size-5`, `text-primary`, **no** `rounded-lg bg-primary/15` box — the icon is the accent, not its backdrop.
- **Title:** the `display` role (24px semibold, tight). Single line, no eyebrow line above.
- **Description:** the muted `meta` role (13px, relaxed leading), max width by parent. Hero counters (`3 activos · 5 total`) use the same role with `tabular-nums` and the count itself in `text-foreground`.
- **Meta slot (right-aligned on `sm+`):** one primary `Button` + calm counter copy (`3 activos · 5 total`) or a tiny state dot + micro-caps label (`Activo` / `Deshabilitado`). Never badges.
- **Used everywhere:** the same `PageHero` renders the dynamic icon/title/description/status on both overview pages (inside `PageShell`) and detail pages (inside `Detail.astro`'s frame). There is no separate detail-only header component.

### Section Heading (`SectionHeading`)

The typographic heading one level below `PageHero`, for a section inside a page, sheet or dialog.

- **Shape:** a `Text` label (`h2` by default, `h3` inside an already-headed block) — no border, no icon, no badge.
- **Count:** optional `(n)` after the title in sentence-case `tabular-nums`, same muted tone, regular weight — typeset, never badged.
- **Action:** optional right-aligned control (one small `Button`), `justify-between` on the same row.
- **Used by:** organization detail sections (miembros, invitaciones, roles, equipos), the team members sheet and the home page's grid titles.

### Detail Layout (`Detail.astro`)

- **Shape:** an Astro layout, not a React component — it owns the `<main class="px-4 py-6 sm:px-6">` frame, centred at `max-w-6xl` by default or `lg:max-w-[80%]` with `maxWidth="80%"` (the same width as its overview), and a static, zero-JS back link so the mounted feature island only supplies the dynamic content via `PageHero`.
- **Back link:** the `status` recipe as utilities (`text-status uppercase tracking-(--tracking-eyebrow)`, `text-muted-foreground`), hover → `text-foreground`; `size-3` arrow icon, real `<a href>` (no client directive needed). The 404 page's "Volver al inicio" uses the same link under a `display` title.
- **Island rule:** because `Detail.astro` already owns `<main>`/width/back-link, the mounted feature component wraps itself in a bare `QueryProvider`, never a second `PageShell`.

### List Row

- **Container:** single `rounded-xl border bg-card/40 divide-y` — one container per page, never row-as-card. `SoftCardList` is that container as a component (`as="ul"` when children are `<li>`); reach for it instead of re-typing the class string.
- **Row:** `hover:bg-muted/40`, **no** `translate` or shadow. Disabled rows: `opacity-60`.
- **Status dot:** `size-1.5` left margin; `bg-primary` for active/running, `bg-border` for inactive/paused, `bg-destructive` for failed, `bg-foreground` for success (neutral — never green), `bg-muted-foreground/40` for skipped. Rendered through `StatusDot` (see below), never an ad-hoc `span`.
- **Entrance:** `dash-enter` with `style={{ "--dash-delay":`${index * 40}ms`}}`. Cap stagger at ~40ms/item; for huge lists, drop the stagger rather than slow it down.

### Surface Card (`SurfaceCard`/`SurfaceCardGrid`)

Registry-driven destination tile — the single component behind both the home
page's top-level module grid and a section overview's per-subroute grid (see
`app-surfaces.ts` under Icon System below). One component, two states:

- **Shape:** `rounded-xl border bg-card/40`, `p-5`, no shadow.
- **Icon:** flat, `size-5 text-primary`, no backdrop box.
- **Title:** the `headline` role (16px medium, tight), single line, truncated.
- **Description:** the muted `meta` role at normal leading, ≤ 2 lines (`line-clamp-2`), always reserving two lines (`min-h-[3em]`) so the shortcuts' hairline lands at the same height across a row of tiles.
- **Leaf state** (a surface with no children, e.g. a section-overview card): `Entrar →` microcopy at the bottom-right, `text-muted-foreground` → `text-foreground` on hover.
- **Parent state** (a surface with children, e.g. `/admin` on the home grid): instead of "Entrar", a hairline-separated "Accesos directos" block (titled in the `label` role) lists up to a handful of child-surface shortcuts as filled pills (`bg-muted`, `hover:bg-primary hover:text-primary-foreground`, 1 or 2 columns depending on count) — a quick-access affordance for a section's own subroutes, not a plain link list.
- **Hover (whole tile):** `bg-muted/40` and a slightly firmer border (`border-foreground/15`), no lift, no shadow.

### State Card (`StateCard`)

- **Shape:** `rounded-xl border border-dashed bg-card/40 px-6 py-16` — placeholder, not container.
- **Icon:** flat (no box), `size-10`. Tones: `muted` (default), `destructive` (errors only), `celebrate` (success/solid border).
- **Title:** `font-medium tracking-tight`, `text-base` (muted/destructive), `text-lg` (celebrate).
- **Description:** `text-muted-foreground text-sm leading-relaxed`, `max-w-sm mx-auto`.
- **Action slot:** one inline button. No toasts invented here.
- **Motion:** `dash-enter` on the container; `dash-pop` on nested icons.

### Status Dot / Status Tag (`StatusDot`, `StatusTag`)

The typographic replacement for a status badge.

- **Dot:** a `size-1.5` circle with five tones and nothing else — `primary` (alive/running), `border` (paused/inactive), `destructive` (failed), `foreground` (ok, never green), `muted` (`muted-foreground/40`, skipped). Optional `pulse` (`animate-pulse`) only for an in-flight action.
- **Tag:** the dot (optional) plus micro-caps text in the `status` role of `Text` (`text-xs uppercase tracking-[0.08em]`, muted), `gap-1.5`. Used in hero status slots, row status and sidebar items. A tag may omit the dot for a static label.
- **Rule:** if a state needs showing, it is a `StatusTag`. There is no filled or outlined status pill anywhere in the product.

### Hint (`Hint`)

The bubble that names an icon-only control, in place of the browser's native `title` tooltip.

- **Shape:** the `components/ui/tooltip` popup — `bg-foreground text-background`, `rounded-md`, `px-3 py-1.5 text-xs`, with a 6px arrow pointing at the control. It inverts against the page in both themes (ink bubble on paper, paper bubble on dark), so it reads as a floating layer without a shadow.
- **Timing:** opens after 300ms on hover or keyboard focus; a quick zoom-and-fade from the control's side. Never on touch.
- **Placement:** `top` by default; `bottom` for navbar/header actions; `left` for controls on the right edge.
- **Where:** icon-only row actions, kebab menus, compact comments toggles, copy, back-to-top, navbar actions and the sidebar toggle; also a status tag's explanation (e.g. a ban reason). Not on labelled buttons, obvious inline `×` clear buttons, or touch-only controls.
- **Rule:** the control keeps its `aria-label`; the bubble is the visual name, not the accessible one.

### Active Filter Chips (`FilterChips`)

The one sanctioned chip in the system: a removable token that *is* the active filter, not decoration.

- **Placement:** a wrapping row above the list at every width, rendered only when something is active (`gap-2` between chips, `gap-x-3` to the trailing clear action).
- **Chip:** `h-7 rounded-md border`, `text-xs text-foreground`, label truncates; a `size-5` remove button with a `size-3` x icon in `muted-foreground` → `foreground` + `bg-muted` on hover. The visible button is small but its hit area is extended to 44px with an `after:-inset-3` overlay.
- **Exclude variant:** an excluded facet value shifts to `border-destructive/30 text-destructive` — the destructive ramp reads as "not this", with no new color invented.
- **Clear:** a ghost `sm` "Limpiar" button in `muted-foreground` at the end of the row.
- **Accessible name:** every remove button is labelled `Quitar filtro: <label>`.

### List Action Bar + Filter Sheet (`ListActionBar`, `FilterSheet`)

The narrow-viewport half of `ResourceFilters`. Hidden at `md+`.

- **Bar:** fixed to the bottom edge; see Layout for its surface, scroll behavior, safe-area padding and the `--list-action-bar-offset` contract. Holds one full-width outline "Filtros" button (`h-11`, filters icon, `Filtros · 3` when active — the count is typeset into the label, not badged) plus an optional sort control slot.
- **Sheet:** a bottom `Sheet` with `rounded-t-xl`, capped at `85dvh`, flat (`gap-0 p-0`). Header is a `border-b` row with the title and a ghost "Limpiar"; the body scrolls (`p-4`) with one labelled field per descriptor; the footer is `border-t bg-background` with safe-area bottom padding.
- **Confirm button:** full-width primary `h-11`, and its label is the result: `Ver 12 resultados` / `Ver 1 resultado` / `Sin resultados` / `Cargando…` while the draft total resolves. Facet edits are a draft until confirmed; other kinds apply live.

### Scroll-to-top (`ScrollToTopButton`)

- **Shape:** round (`rounded-full`) primary icon button, `size-11` on mobile, `size-9` on `md+`, `size-4` arrow icon. The system's only resting shadow (`shadow-lg`, see Elevation).
- **Placement:** mounted once per layout in a tight `position: fixed` root, `right: max(1rem, safe-area)` and `bottom: 1rem + safe-area + --list-action-bar-offset` on mobile, `1.5rem`/`1.5rem` on `md+`, `z-40`.
- **Opt-in:** only on pages whose scroller carries `data-scroll-to-top`, and only after 400px of scroll.
- **Motion:** 200ms fade + zoom-from-75% + slide-from-bottom on enter, the reverse on exit; the element unmounts after the exit finishes.
- **Label:** `aria-label` "Volver arriba", named visually by a `Hint` on its left side.

### Compact Pickers (`SegmentedPicker`, `NumberStepper`)

Dense, precise inputs for small finite values (currently the cron schedule builder).

- **Segmented picker:** a `radiogroup` grid of `h-8 rounded-md border text-xs` cells, `gap-1`, column count set by the caller. Unselected cells are `border-input text-muted-foreground` with `hover:bg-muted/40 hover:text-foreground`; the selected cell **inverts to ink** (`bg-foreground text-background border-foreground`) — selection is expressed in monochrome, never with the accent. `mono` switches the labels to `font-mono tabular-nums`. An abbreviated cell (`L`, `M`…) carries its full name as `aria-label` and in a `Hint`.
- **Number stepper:** an `h-9 rounded-md border-input` dial: `w-8` chevron buttons in `muted-foreground` flanking a centered `font-mono text-sm tabular-nums` value, zero-padded to two digits. Values wrap at the bounds; arrows, PageUp/PageDown (±5), Home/End and the mouse wheel all step it. The chevrons are out of the tab order; the input carries focus.
- **Focus:** both use `focus-visible:ring-2 ring-ring/50`.

### Form Dialog (`FormDialog`)

- **Frame:** `DialogContent` with `p-0`, `gap-0`, `sm:max-w-lg`, scrollable up to `calc(100vh - 2rem)`.
- **Header:** `border-b px-6 py-5`, `gap-1.5`, `DialogTitle` (the `headline` recipe, built into the primitive), `DialogDescription` in the `compact` role with relaxed leading.
- **Body:** `space-y-4 px-6 py-5` with `FormField` children. Long sections separated with `border-t`.
- **Footer:** `border-t px-6 py-4`, `Button variant="outline"` cancel + `Button` submit with optional pending spinner (`Loader2 size-4 animate-spin`).
- **Destructive submit:** `submitVariant="destructive"` on the footer button, no other color shift in the dialog.

### Form Field / Field Label (`FormField`, `FieldLabel`)

- **Label:** `FieldLabel` renders `<Text as="label" variant="label" tone="muted">`. This is the recurring micro-caps signature. Full-opacity `muted-foreground`, not `/80` — at this size the faded token fails 4.5:1.
- **Field:** `space-y-2` wrapper, optional hint as a muted `meta` `Text`.
- **Outside forms:** fact rows, filter labels and section titles use the same `label` role (`MetadataCell`, `SectionHeading`) — never shadcn `<Label>` at body size, never a hand-built class string.

### Collapsible Filters (`CollapsibleFilters` + `FilterField`)

- **Frame:** collapsed-by-default `Accordion` panel — a single "Filtros" trigger row (`min-h-11`) that expands into a control grid. One panel per list page; not a permanently-open filter row.
- **Trigger:** `SlidersHorizontal` icon (`size-4 text-muted-foreground`) + label + an active count in muted tabular text (`3 activos`) when `activeCount > 0` — typeset, never a `Badge`.
- **Body:** `FilterField` children (label + control) in a responsive grid (`columns` prop: 1–4, e.g. `grid-cols-1 sm:grid-cols-3`), plus an outline "Limpiar filtros" button with `FilterX` icon when a filter is active.
- **Count:** optional `text-xs text-muted-foreground` line below the panel.
- **Rule:** this is the only filter UI for list pages at `md+` — never a hand-rolled flat filter row. Below `md` the same descriptors render as `ListActionBar` + `FilterSheet`; both halves come from `ResourceFilters`, never wired by hand. `FilterBar` (the old always-visible search+filters+count row) is superseded and no longer used anywhere in the codebase.

### Navigation (sidebar / navbar)

- **Navbar:** translucent, `bg-background/80 backdrop-blur`, height `--navbar-height: 3.6rem`. At rest the bottom hairline is faint (`border-border/40`); past a scroll threshold it firms up to `border-border` plus a hairline `shadow-sm` — the one navbar affordance allowed to leave "flat by default", used only as a scroll cue.
- **Nav pill (navbar hub menu):** active item is `bg-primary/10 text-primary`; resting item is `text-muted-foreground`, hover `bg-muted/40 hover:text-foreground`.
- **Sidebar (`SectionSidebar`, admin/section sidebars):** built on shadcn's `Sidebar`/`SidebarMenuButton` primitives, which key hover and `data-[active=true]` state off the dedicated `--sidebar-accent` / `--sidebar-accent-foreground` tokens (`hover:bg-sidebar-accent`), not the generic `bg-muted/40` utility the rest of the system uses. No badge clusters.
- **Rich menu rows (`MenuItemText`):** navigation-menu links and dropdown items that pair an icon with a name and a short explanation render their text column through `MenuItemText` — a compact medium label (inherits the row color, so active rows turn `text-primary`) over a muted description clamped to two lines. The row itself owns padding, icon and hover/active styling.
- **Theme toggle:** circular `clip-path` reveal animation (see `use-theme-toggle.ts`), never abrupt flicker.

### Buttons (shadcn `Button` over the token system)

- **Primary:** `background-color: var(--primary)`, `color: var(--primary-foreground)`, `border-radius: var(--radius)` (4–6px), uppercase only on `text-xs` tertiary actions, not on primary CTAs.
- **Outline:** hairline `border`, transparent background, `text-foreground`. Hover: `bg-muted/40`.
- **Ghost:** flat, hover: `bg-muted/40`.
- **Destructive:** the editorial ink ramp above.

### Inputs / Fields (shadcn `Input`)

- **Style:** `h-8` (compact) / default height on form bodies, `border-color: var(--input)`, `border-radius: var(--radius)`.
- **Focus:** `ring-2 ring-ring ring-offset-2 ring-offset-background` (Brand Terracotta). Visible only on keyboard focus.
- **Error:** shifts `border-color` to `var(--destructive)`; no inline icon, no color icon box — message lives in `text-destructive text-xs` microcopy beneath the field.

## Icon System

All icons are sourced from **Lucide React** (`lucide-react`). To ensure visual consistency across the entire application, every feature has a **single canonical icon** defined in a centralised registry.

### Icon Registry

The file `apps/frontend/src/lib/icon-registry.ts` is the single source of truth for all icons, grouped by semantic domain rather than a flat feature list: `navigation`, `auth`, `admin`, `entities`, `identity`, `security`, `actions`, `controls`, `status`, `views`, `communication`, `scheduling`, `theme`. Within a group, keys name the concept (`navigationIcons.crons`, `statusIcons.loading`), and the same Lucide icon can legitimately appear under two keys when it serves two concepts — the invariant is one canonical icon per *concept*, not one key per file.

### Usage

Always resolve through the two-argument helper — there is no flat `iconRegistry.<key>` shorthand:

```typescript
import { getIcon } from "@/lib/icon-registry"

const CronsIcon = getIcon("navigation", "crons")   // Type-safe, returns the Lucide component
const LoadingIcon = getIcon("status", "loading")
```

### Rules

**The One Icon Rule.** If crons use the `Clock` icon, that icon **must** appear in:

- The `/crons` page hero
- The `/crons/[id]` detail page
- Navigation (navbar, sidebar)
- Any breadcrumb, list row, or dialog that references crons
- Admin or dashboard tiles that link to crons

If an icon needs to change, update it in `icon-registry.ts` — all references propagate automatically.

**Lucide only.** Do not import custom SVG icons or use system icons. Every icon comes from Lucide.

## Do's and Don'ts

### Do

- **Do** use `PageShell` to frame list/overview authenticated pages; let it own `QueryProvider`, padding, and max-width. Detail routes use `Detail.astro` (bare `QueryProvider` + `PageHero`); auth keeps its own frame.
- **Do** keep the page header to one icon, one title, one description, and one primary action. Counters and statuses are typeset, not badged.
- **Do** express state as a dot (`bg-primary` / `bg-border` / `bg-destructive` / `bg-foreground`) plus a micro-caps label, never as a filled `Badge`.
- **Do** reserve Brand Terracotta for hero icon, primary CTA, and "alive" state dot.
- **Do** wrap list rows in one `divide-y` container; one container per page.
- **Do** use `FieldLabel` for form labels, `SectionHeading` for section titles and the `label` role of `Text` for every other micro-caps label; never hand-build the class string.
- **Do** set text through a `Text` role (or `textVariants` on a component's `className`); use the `data` role (JetBrains Mono, `tabular-nums`) for cron expressions, durations, ISO timestamps, and IDs.
- **Do** name every icon-only control with a `Hint` bubble and keep its `aria-label`.
- **Do** animate list entrances with `dash-enter` and a `--dash-delay` step of ~40ms.
- **Do** reach for `FormDialog` + `FormField` for every create/edit dialog; let it own header/footer hairlines.
- **Do** drive list-page filters through `ResourceFilters` descriptors: `CollapsibleFilters` at `md+`, `ListActionBar` + `FilterSheet` below; never a hand-rolled always-open filter row.
- **Do** show active filters as `FilterChips` above the list, with a 44px hit area on every remove control.
- **Do** keep every fixed bottom element clear of `env(safe-area-inset-bottom)` and give its controls 44px touch targets.
- **Do** express selection in compact pickers by inverting to ink (`bg-foreground text-background`), not with the accent.
- **Do** keep `DialogHeader` `border-b` and `DialogFooter` `border-t`; long bodies separated with `border-t`.
- **Do** reach for `AppLink` for internal routing; raw `<a>` is out.
- **Do** format dates through `@/lib/format`; never reinvent `formatDate`.
- **Do** import icons from `@/lib/icon-registry`; never import Lucide icons directly. One icon per feature, consistent everywhere.

### Don't

- **Don't** wrap an icon in `rounded-lg bg-primary/15 text-primary` on a row or tile; the flat accent is the accent.
- **Don't** invent semantic colors for success/info/warning; success is `bg-foreground` + word, failure is destructive, neutral state is `bg-border`.
- **Don't** render rows as free-floating cards with `shadow-md`; one `divide-y` container.
- **Don't** count things with `Badge variant="outline"`; typeset `3 activos · 5 total` as text.
- **Don't** nest cards (`Card` inside `Card`, or `Card` around a facts grid); `border-y` + `<dl>` is enough.
- **Don't** use gradients, glow, or decorative `shadow-lg`/`shadow-xl` in product chrome. The floating back-to-top button is the single sanctioned resting shadow.
- **Don't** build chip/pill clusters in the hero or on tiles; subaccess is a typographic list. The only chips in the product are removable active-filter chips.
- **Don't** add another `<main class="container…">` in the `.astro`; `PageShell` is the frame.
- **Don't** use `formatDate` / `formatDateTime` locals; the helper `@/lib/format` is the source of truth.
- **Don't** link internally with raw `<a>`; `AppLink` is the source of truth.
- **Don't** use generic `DialogContent` + `Label` for forms; reach for `FormDialog` + `FieldLabel`.
- **Don't** reach for `Badge`, `Button` chips, or primary-colored borders when type and dots would do.
- **Don't** rely on the browser's native `title` tooltip on a control; it carries no design. Use `Hint`.
- **Don't** hand-build initials tiles; `UserAvatar` owns the monochrome fill and initials.
- **Don't** import Lucide icons directly (`import { Clock } from "lucide-react"`); always go through `icon-registry`. If a feature's icon isn't registered, add it to the registry first.

### Exceptions (per PRODUCT.md)

The style applies to product surfaces (lists, detail, forms, settings). It does **not** apply to:

- `components/ui/**` (shadcn base — they remain the available primitives).
- `features/app-shell` chrome (navbar, sidebar, theme toggle) — small adjustments permitted.
- `/login`, `/signup` — may stay as form-card; not a list/detail page.

## Signing surfaces (Garabato)

The colour tokens above are pinned by the user and do not change; the signing product speaks through type, near-square corners, the sheet and the rubric.

- **The sheet.** A PDF page (viewer, library thumbnail) or the home drop zone is a sheet: `bg-white` (`bg-background` for the drop zone), `rounded-sm`/`rounded-lg`, `shadow-sheet` (a soft offset paper shadow, the one sanctioned resting shadow besides back-to-top), resting on `bg-desk`. The home page and the document viewer pane sit on `bg-desk`.
- **The rubric** (`components/shared/brand/rubric.tsx`): the logo's single stroke over its baseline as live SVG, the stroke in `stroke-brand` (the logo terracotta). `motion="write"` draws it once (the home drop zone), `motion="loop"` keeps writing during an upload, `static` marks a signed document's thumbnail corner. Reduced motion always shows the finished mark. It is the product's one authored motion moment.
- **Home** (`/`): a signing desk, no stats and no pending/recent panels. The drop zone (`features/documents/overview/components/document-drop-zone.tsx`) owns the `h1` ("Suelta un PDF para firmarlo"); a dropped or picked PDF is validated (`pdfFileProblem`), uploaded and opened at `/documents/<id>?firmar=1` with signing open. The side column lists the certificates that will sign (status, expiry, whether the password is remembered) and links to the library.
- **Library** (`/documents`): thumbnails by default (`DocumentGrid`, first page rendered lazily with pdf.js through `useDocumentPreviewFile`), `?vista=lista` switches to the `EntityList` rows. Name, facts (`3 páginas · 412 KB`) and a `StatusTag` sit under each sheet; actions live in `RowActionsMenu`.
- **Certificates** (`/certificates`): the certificates lie on one `bg-desk` surface (`rounded-xl`) as credentials (`features/certificates/overview/components/certificate-grid.tsx`): one `bg-background` sheet with `shadow-sheet` each, 1 to 3 columns by container width. A sheet carries the alias (`headline`), the holder when it differs, NIF/NIE (`data`) and issuer as a `<dl>`, and the validity line: issue date to expiry, solid up to today and dashed after, with the status dot standing on today and the remaining days typeset beside the status (`Quedan 812 días`). The solid stretch rules itself in once (`validity-draw`, 0.9s expo-out, skipped under reduced motion), following the cards' `dash-enter` stagger. A hairline footer holds the password state and "Ver firmas"; rename, remember/forget password and delete live in `RowActionsMenu`. An expired credential sits at `opacity-60` until hovered.
- **Document detail** (`/documents/[id]`): the hero mirrors the library card — the file name as title (allowed to wrap mid-token), the same facts line (`3 páginas · 412 KB`) as description and the signing `StatusTag` (`Firmado` / `Sin firmar`) beside Descargar/Firmar. `Detail.astro fillViewport` pins the page to the viewport; from `lg` only the PDF pane (and the side panel when it overflows) scrolls, below `lg` the page root scrolls as one. The side panel opens with the signing card (`headline` title) when signing, then "Versiones (n)" and "Firmas (n)" as `SectionHeading`s over `SoftCardList` rows: a `title` name over a `compact` muted line (date, size, page).
- **Crons** stay routable at `/crons` but are out of the navbar, the home and the surface search.

