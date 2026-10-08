import { createCn } from "cn/config"

/**
 * The role-based type utilities from `global.css` (`text-label`,
 * `text-meta`, …). The class merger doesn't know them, and an unknown
 * `text-*` class is filed under text colour — so `text-label` next to
 * `text-muted-foreground` was silently dropped, losing the role's size.
 * Registering them as font sizes keeps the size and still lets a later
 * `text-xs` override one.
 */
const typeRoles = [
  "display",
  "headline",
  "body",
  "meta",
  "meta-sm",
  "label",
  "status",
  "stat",
]

/**
 * Components added with `shadcn add` import `cn` from the `cn` package;
 * rewrite that import to `@/lib/utils` so they get these type roles.
 */
export const cn = createCn({
  extend: {
    classGroups: {
      "font-size": [{ text: typeRoles }],
    },
  },
})
