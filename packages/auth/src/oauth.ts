import { env } from "@nonete/env/server"
import { genericOAuth } from "better-auth/plugins"

export const GENERIC_OAUTH_PROVIDER_ID = "generic"

export function isOidcConfigured() {
  const { OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, OIDC_DISCOVERY_URL } = env
  return Boolean(OIDC_CLIENT_ID && OIDC_CLIENT_SECRET && OIDC_DISCOVERY_URL)
}

export function buildGenericOAuthPlugin() {
  const { OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, OIDC_DISCOVERY_URL } = env
  if (!OIDC_CLIENT_ID || !OIDC_CLIENT_SECRET || !OIDC_DISCOVERY_URL) {
    return null
  }
  return genericOAuth({
    config: [
      {
        providerId: "oidc",
        clientId: OIDC_CLIENT_ID,
        clientSecret: OIDC_CLIENT_SECRET,
        discoveryUrl: `${OIDC_DISCOVERY_URL}/.well-known/openid-configuration`,
        scopes: ["openid", "profile", "email"],
      },
    ],
  })
}
