import { env } from "@nonete/env/server"

/**
 * Envelope encryption for stored secrets (certificates and documents). Each
 * record gets its own random data key, wrapped by the master key; its values
 * (a PKCS#12 file, a password, a document version) are sealed with that data
 * key. Every seal is AES-256-GCM with `<kind>:<id>:<purpose>` as additional
 * authenticated data, so a value only opens in the record and slot it was
 * sealed for. Certificates sealed before scopes existed used exactly
 * `certificate:<id>:<purpose>`, so they keep opening.
 *
 * Layout: version (1 byte) ‖ iv (12 bytes) ‖ ciphertext ‖ tag (16 bytes).
 * The version names the master-key generation, so a future rotation or KMS
 * move can rewrap data keys without a schema change.
 */

const FORMAT_VERSION = 1
const IV_BYTES = 12
const KEY_BYTES = 32

/** The record a value belongs to. */
export type VaultScope = { kind: "certificate" | "document"; id: string }

/** The slot of a value inside its record; `v<n>` is a document version. */
export type SealPurpose = "p12" | "password" | `v${number}`
type Purpose = SealPurpose | "dek"

export class VaultError extends Error {}

export function additionalData(scope: VaultScope, purpose: Purpose) {
  return new TextEncoder().encode(`${scope.kind}:${scope.id}:${purpose}`)
}

function importKey(raw: Uint8Array<ArrayBuffer>) {
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ])
}

async function seal(
  key: Uint8Array<ArrayBuffer>,
  scope: VaultScope,
  purpose: Purpose,
  plaintext: Uint8Array<ArrayBuffer>
) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: additionalData(scope, purpose) },
    await importKey(key),
    plaintext
  )
  return Buffer.concat([
    Uint8Array.of(FORMAT_VERSION),
    iv,
    new Uint8Array(ciphertext),
  ])
}

async function open(
  key: Uint8Array<ArrayBuffer>,
  scope: VaultScope,
  purpose: Purpose,
  sealed: Uint8Array
) {
  if (sealed[0] !== FORMAT_VERSION) {
    throw new VaultError(`Unknown sealed format version ${sealed[0]}`)
  }
  try {
    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: sealed.slice(1, 1 + IV_BYTES),
        additionalData: additionalData(scope, purpose),
      },
      await importKey(key),
      sealed.slice(1 + IV_BYTES)
    )
    return new Uint8Array(plaintext)
  } catch {
    // Wrong key, wrong id or purpose, or tampered bytes: GCM cannot tell
    // them apart, and none of them may return data.
    throw new VaultError(`Sealed ${purpose} value could not be opened`)
  }
}

export function createVault(masterKeyBase64: string) {
  const masterKey = new Uint8Array(Buffer.from(masterKeyBase64, "base64"))
  if (masterKey.length !== KEY_BYTES) {
    throw new VaultError("The master key must be 32 bytes")
  }
  return {
    newDataKey: () => crypto.getRandomValues(new Uint8Array(KEY_BYTES)),
    wrapDataKey: (scope: VaultScope, dataKey: Uint8Array<ArrayBuffer>) =>
      seal(masterKey, scope, "dek", dataKey),
    unwrapDataKey: (scope: VaultScope, wrapped: Uint8Array) =>
      open(masterKey, scope, "dek", wrapped),
    seal: (
      dataKey: Uint8Array<ArrayBuffer>,
      scope: VaultScope,
      purpose: SealPurpose,
      plaintext: Uint8Array<ArrayBuffer>
    ) => seal(dataKey, scope, purpose, plaintext),
    open: (
      dataKey: Uint8Array<ArrayBuffer>,
      scope: VaultScope,
      purpose: SealPurpose,
      sealed: Uint8Array
    ) => open(dataKey, scope, purpose, sealed),
  }
}

export type Vault = ReturnType<typeof createVault>

export const vault = createVault(env.CERTIFICATE_ENCRYPTION_KEY)
