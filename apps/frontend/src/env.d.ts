/// <reference path="../.astro/types.d.ts" />

import type { auth } from "@nonete/auth"

declare global {
  namespace App {
    interface Locals {
      // Inferred from the auth instance so plugin fields (the admin plugin's
      // `role`, etc.) survive into `Astro.locals` — the plain better-auth
      // `User` type drops them.
      user: typeof auth.$Infer.Session.user | null
      session: typeof auth.$Infer.Session.session | null
    }
  }
}
