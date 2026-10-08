import { apiKeyClient } from "@better-auth/api-key/client"
import { ac, roles } from "@nonete/auth/permissions"
import { adminClient, organizationClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
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
  ],
})

/**
 * Every `authClient` call resolves to `{ data, error }` instead of throwing.
 * All query/mutation functions in this app want the same thing: throw on
 * `error`, otherwise unwrap `data` — this is that unwrap, once.
 */
export async function unwrapAuth<T>(
  result: Promise<{ data: T | null; error: unknown }>
): Promise<T> {
  const { data, error } = await result
  if (error) throw error
  return data as T
}
