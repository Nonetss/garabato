/**
 * Deterministically derives a UUID-shaped string from an arbitrary seed.
 *
 * Some entities the app attaches comments/records to (e.g. Better Auth
 * plugin ids like "admin", "apiKey") are not backed by a real UUID primary
 * key, but polymorphic references such as `comments.entityId` are typed
 * `uuid` in the DB. This produces a stable pseudo-UUID for the same seed
 * every time, without needing a DB-side id or an async crypto call.
 *
 * Not cryptographically random — only used to satisfy a UUID-shaped column
 * for entities that don't have one of their own.
 */

function cyrb128(seed: string): [number, number, number, number] {
  let h1 = 1779033703
  let h2 = 3144134277
  let h3 = 1013904242
  let h4 = 2773480762
  for (let i = 0; i < seed.length; i++) {
    const k = seed.charCodeAt(i)
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067)
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233)
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213)
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179)
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067)
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233)
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213)
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179)
  h1 ^= h2 ^ h3 ^ h4
  h2 ^= h1
  h3 ^= h1
  h4 ^= h1
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0]
}

function toHex32(n: number): string {
  return n.toString(16).padStart(8, "0")
}

export function deterministicUuid(seed: string): string {
  const [h1, h2, h3, h4] = cyrb128(seed)
  const hex = toHex32(h1) + toHex32(h2) + toHex32(h3) + toHex32(h4)
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `8${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-")
}
