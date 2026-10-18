import { createHmac, timingSafeEqual } from "node:crypto"

// TOTP as Better Auth's `twoFactor` plugin issues it (RFC 6238): HMAC-SHA1
// keyed with the secret's UTF-8 bytes, 6 digits, 30-second steps, one step
// of clock drift either way.
const DIGITS = 6
const PERIOD_MS = 30 * 1000
const DRIFT_STEPS = 1

function hotp(secret: string, counter: number) {
  const counterBytes = Buffer.alloc(8)
  counterBytes.writeBigUInt64BE(BigInt(counter))
  const mac = createHmac("sha1", Buffer.from(secret, "utf8"))
    .update(counterBytes)
    .digest()
  const offset = (mac.at(-1) ?? 0) & 0x0f
  const truncated = mac.readUInt32BE(offset) & 0x7fffffff
  return String(truncated % 10 ** DIGITS).padStart(DIGITS, "0")
}

function sameCode(a: string, b: string) {
  return (
    a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))
  )
}

/**
 * The time step whose code matches, or null when the code is not valid at
 * `now`. Every candidate step is compared, so timing does not reveal which.
 */
export function matchTotpStep(
  secret: string,
  code: string,
  now: number
): number | null {
  const current = Math.floor(now / PERIOD_MS)
  let matched: number | null = null
  for (
    let step = current - DRIFT_STEPS;
    step <= current + DRIFT_STEPS;
    step++
  ) {
    if (sameCode(code, hotp(secret, step))) matched = step
  }
  return matched
}

/** The code valid at `now`; tests use it to stand in for the app. */
export function totpAt(secret: string, now: number) {
  return hotp(secret, Math.floor(now / PERIOD_MS))
}
