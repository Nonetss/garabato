/**
 * The base32 secret inside an `otpauth://totp/...?secret=...` URI, for typing
 * it into an authenticator app that cannot scan the QR code. `null` when the
 * URI is malformed or carries no secret.
 */
export function totpSecretOf(uri: string): string | null {
  if (!URL.canParse(uri)) return null
  const secret = new URL(uri).searchParams.get("secret")
  if (!secret) return null
  return secret
}
