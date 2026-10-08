# Hints (`Hint`)

An icon-only control is named visually with `Hint` (`apps/frontend/src/components/shared/feedback/hint.tsx`): the `components/ui/tooltip` bubble with an arrow, opened on hover or keyboard focus after 300ms. Never with a native `title` attribute, whose browser tooltip carries no design.

```tsx
<Hint label="Editar nombre">
  <Button variant="ghost" size="icon-sm" aria-label="Editar nombre">
    <Pencil aria-hidden="true" />
  </Button>
</Hint>
```

## Rules

- **Keep the `aria-label`.** The bubble is a visual hint, not the control's accessible name. `label` is usually the same text, or a shorter one when the `aria-label` carries the entity name (`aria-label={`Eliminar ${name}`}` → `label="Eliminar miembro"`).
- **The child is the trigger.** `Hint` renders its child through `TooltipTrigger render`, so the child must accept props and a ref: `Button`, `NavbarAction`, `NavbarActionLink`, `Text`, or a menu/popover trigger. With a `DropdownMenuTrigger` or `PopoverTrigger`, wrap the trigger itself: `<Hint label="Cambiar tema"><DropdownMenuTrigger render={<NavbarAction …/>}>…</DropdownMenuTrigger></Hint>`.
- **Conditional icon-only.** When a control is icon-only only in one mode (`compact`), build it once and wrap it only in that mode: `return compact ? <Hint label={label}>{button}</Hint> : button`.
- **`side`** defaults to `top`. Navbar and header controls use `bottom`, and controls on the right edge (the back-to-top button) use `left`.

## Where it makes sense

- **Use it on:** icon-only row actions (edit, delete, remove, pause/resume), kebab menus (`RowActionsMenu`), comments toggles in compact mode, `CopyButton`, `ScrollToTopButton`, navbar/header icon actions, the sidebar toggle and abbreviated options (`SegmentedPicker` cells with a `title`, whose full name also becomes their `aria-label`). It also replaces a hover explanation on a non-interactive element such as `StatusTag`'s `title` prop.
- **Don't use it on:** controls that already show their text; the obvious `×` clear button inside a picker or chip; buttons next to a text field the user is typing in, where it would cover the text; the mobile hamburger or other touch-only controls, since touch devices never show it; options inside a select or menu popup.
- `SidebarMenuButton` has its own `tooltip` prop for the collapsed sidebar; use that there, not `Hint`.
