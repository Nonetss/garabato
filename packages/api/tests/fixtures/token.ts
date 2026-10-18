import type { auth } from "@nonete/auth"
import { type ListedApiKey, listedApiKey } from "#tests/fixtures/auth"

type VerifiedApiKey = Awaited<ReturnType<typeof auth.api.verifyApiKey>>

/** A token key as Better Auth's `verifyApiKey` returns it when valid. */
export function verifiedTokenKey(
  overrides: Partial<ListedApiKey> = {}
): VerifiedApiKey {
  return {
    valid: true,
    error: null,
    key: listedApiKey({
      name: "Firefox portátil",
      referenceId: "user-id",
      permissions: { certificateToken: ["use"] },
      ...overrides,
    }),
  }
}

/** A key `verifyApiKey` refuses: unknown, revoked or without the permission. */
export function refusedTokenKey(): VerifiedApiKey {
  return {
    valid: false,
    error: { message: "Invalid API key", code: "KEY_NOT_FOUND" },
    key: null,
  }
}
