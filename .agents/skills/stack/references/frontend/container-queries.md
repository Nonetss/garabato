# Container queries vs viewport breakpoints

Tailwind v4 has container queries built in. `@container` on an element makes it a query container (`container-type: inline-size`); descendants then use `@md:`, `@xl:`, `@4xl:`… which match **that element's width**, while `sm:`, `md:`, `lg:`… match **the viewport**.

## The rule

| Use | For | Why |
|---|---|---|
| **Container variants** (`@container` + `@md:`…) | Content laid out inside a page: card grids, metadata grids, filter field grids, list row layouts, form field grids, any reusable component that arranges its own children | The space a page body gets is not the viewport: the section sidebar takes up to 16rem (open or collapsed), `PageShell` caps at 80 % from `lg`, a dialog column can be half the dialog. A component reused in a full page and in a narrow panel must lay out for the width it actually has. |
| **Viewport variants** (`sm:`, `md:`, `lg:`…) | App chrome (navbar, sidebars, mobile filter `ListActionBar` and bottom sheet, scroll-to-top), the size of overlays (`sm:max-w-xl` on dialogs, sheets, popovers), page-level padding, and layouts inside a dialog whose width is itself set from the viewport | These really follow the browser window; specs pin some of them to viewport breakpoints (e.g. the filter bar below 768 px). |

If in doubt: would this layout look wrong when the sidebar opens or when the component is dropped into a narrower box? Then it needs a container query.

## Syntax

```tsx
<div className="@container min-w-0">
  <div className="grid grid-cols-1 gap-3 @xl:grid-cols-2 @4xl:grid-cols-3">…</div>
</div>
```

Sizes (min-width of the container): `@3xs` 16rem · `@2xs` 18rem · `@xs` 20rem · `@sm` 24rem · `@md` 28rem · `@lg` 32rem · `@xl` 36rem · `@2xl` 42rem · `@3xl` 48rem · `@4xl` 56rem · `@5xl` 64rem · `@6xl` 72rem · `@7xl` 80rem.

- Arbitrary sizes: `@min-[90rem]:grid-cols-5`, `@max-[30rem]:hidden`.
- Max-width variants: `@max-md:` (below `@md`).
- Named containers, only when a descendant must skip a nearer container: `@container/card-header` + `@md/card-header:` (shadcn's `ui/card.tsx` does this).

## Where to put `@container`

- **An element cannot query itself.** Put `@container` on the parent whose width is the space the layout owns, and the responsive classes on the child.
- Components that are a grid at their root wrap it: `<div className="@container min-w-0"><div className="grid …">`. Keep `className` targeting the grid when callers already style it (`MetadataList`) or the wrapper when callers only position the block (`SurfaceCardGrid`).
- Row layouts query the list: `EntityList` puts `@container` on the `ul`, rows use `@2xl:` variants.
- Shared components own their container, so callers never add another one around them.

## Overrides through `className`

A caller that tweaks a shared grid through `className` (or a descriptor's `className`, e.g. a `MetadataDefinitionList` field) must use container variants too — `@xl:col-span-3`, not `sm:col-span-2`. Mixing a viewport variant into a container-driven grid brings back the bug.

## Static class lookups

Keep full literal strings in lookups (`{ 2: "grid-cols-1 @lg:grid-cols-2" }`). Tailwind cannot see `` `@lg:grid-cols-${n}` ``.

## Pitfalls

- `container-type: inline-size` stops the element from sizing to its content. In a shrink-to-fit context (inline-flex, `w-fit`, absolutely positioned, a flex item without `flex-1`/`min-w-0`) the container can collapse to 0 width. Use block wrappers in stretched contexts and add `min-w-0` inside flex/grid parents.
- Nested containers: a variant always resolves against the **nearest** `@container` ancestor. A grid inside `MetadataList` inside an `EntityList` row queries `MetadataList`'s wrapper, not the list.
- Don't combine `sm:` and `@sm:` for the same property on one element; pick the reference that matches the rule above.

## Components that already own a container

`SurfaceCardGrid`, `MetadataList` / `MetadataDefinitionList`, `CollapsibleFilters` (field grid), `EntityList` (rows and metadata), `CollectionCardGrid`, `SavedResourceList`, admin session rows, `ThemeModeSelector`, `CronScheduleBuilder`, `ui/card` (`@container/card-header`).
