# Hints (`Hint`)

An icon-only control is named visually with `Hint` (`apps/frontend/src/components/shared/feedback/hint.tsx`): the `components/ui/tooltip` bubble with an arrow, opened on hover or keyboard focus after 300ms. Never with a native `title` attribute, whose browser tooltip carries no design.

A plain icon-only button uses `IconButton` (`components/shared/form/icon-button.tsx`), which is that composition as one component: `label` is both the bubble and the `aria-label`.

```tsx
<IconButton label="Editar nombre" icon={Pencil} onClick={openEditName} />

// The accessible name carries the entity; the bubble stays generic.
<IconButton
  label="Eliminar etiqueta"
  accessibleLabel={`Eliminar ${tag.name}`}
  icon={DeleteIcon}
  onClick={() => onDelete(tag)}
/>
```

It defaults to a ghost `icon-sm` `type="button"`; `pending` swaps the glyph for a decorative `Spinner` and sets `aria-busy`. Wrap `Hint` by hand only around what `IconButton` can't be: a menu, popover or dialog trigger, a non-button element, or a control that is icon-only in one mode only.

## Rules

- **Keep the `aria-label`.** The bubble is a visual hint, not the control's accessible name. `label` is usually the same text, or a shorter one when the `aria-label` carries the entity name (`aria-label={`Eliminar ${name}`}` → `label="Eliminar miembro"`).
- **The child is the trigger.** `Hint` renders its child through `TooltipTrigger render`, so the child must accept props and a ref: `Button`, `NavbarAction`, `NavbarActionLink`, `Text`, or a menu/popover trigger. With a `DropdownMenuTrigger` or `PopoverTrigger`, wrap the trigger itself: `<Hint label="Cambiar tema"><DropdownMenuTrigger render={<NavbarAction …/>}>…</DropdownMenuTrigger></Hint>`.
- **Conditional icon-only.** When a control is icon-only only in one mode (`compact`), build it once and wrap it only in that mode: `return compact ? <Hint label={label}>{button}</Hint> : button`.
- **`side`** defaults to `top`. Navbar and header controls use `bottom`, and controls on the right edge (the back-to-top button) use `left`.

## Where it makes sense

- **Use it on:** icon-only row actions (edit, delete, remove, pause/resume), kebab menus (`RowActionsMenu`), comments toggles in compact mode, `CopyButton`, `ScrollToTopButton`, navbar/header icon actions, the sidebar toggle and abbreviated options (`SegmentedPicker` cells with a `title`, whose full name also becomes their `aria-label`). It also replaces a hover explanation on a non-interactive element such as `StatusTag`'s `title` prop.
- **Don't use it on:** controls that already show their text; the obvious `×` clear button inside a picker or chip; buttons next to a text field the user is typing in, where it would cover the text; the mobile hamburger or other touch-only controls, since touch devices never show it; options inside a select or menu popup.
- `SidebarMenuButton` has its own `tooltip` prop for the collapsed sidebar; use that there, not `Hint`.
