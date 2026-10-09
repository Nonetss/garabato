import { BACKEND_URL } from "astro:env/server"
import { apiKeyClient } from "@better-auth/api-key/client"
import { ac, roles } from "@nonete/auth/permissions"
import type { AstroGlobal } from "astro"
import { createAuthClient } from "better-auth/client"
import {
  adminClient,
  organizationClient,
  twoFactorClient,
} from "better-auth/client/plugins"

export const authServer = createAuthClient({
  baseURL: BACKEND_URL,
  plugins: [
    apiKeyClient(),
    adminClient(),
    organizationClient({
      teams: {
        enabled: true,
      },
      ac,
      roles,
      dynamicAccessControl: {
        enabled: true,
      },
    }),
    // Same plugins as the browser client, so the session user carries
    // `twoFactorEnabled` here too.
    twoFactorClient(),
  ],
})

export async function getSession(astro: AstroGlobal) {
  return authServer.getSession({
    fetchOptions: { headers: astro.request.headers },
  })
}
