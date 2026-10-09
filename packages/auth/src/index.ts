import { apiKey } from "@better-auth/api-key"
import { db } from "@nonete/db"
import * as schema from "@nonete/db/schema/auth"
import { env } from "@nonete/env/server"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { admin, organization } from "better-auth/plugins"
import { ac, roles } from "#auth/permissions"
import { buildGenericOAuthPlugin } from "./oauth"

export function createAuth() {
  const oauthPlugin = buildGenericOAuthPlugin()
  const oauthEnabled = oauthPlugin !== null

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: schema,
    }),
    trustedOrigins: [env.CORS_ORIGIN],
    emailAndPassword: {
      enabled: true,
      disableSignUp: env.DISABLE_SIGN_UP,
    },
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 60,
      },
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    advanced: {
      defaultCookieAttributes: {
        sameSite: "lax",
        secure: true,
        httpOnly: true,
      },
    },
    plugins: [
      admin(),
      apiKey({ enableSessionForAPIKeys: true }),
      organization({
        teams: {
          enabled: true,
        },
        ac,
        roles,
        dynamicAccessControl: {
          enabled: true,
        },
      }),
      ...(oauthEnabled ? [oauthPlugin] : []),
    ],
  })
}

export const auth = createAuth()
