/** How long an install code can be redeemed. */
export const INSTALL_CODE_TTL_MS = 10 * 60 * 1000

// Crockford's base32 without I, L, O and U: nothing to misread when the code
// is typed or read aloud. 8 characters are 40 bits, plenty for 10 minutes.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
const LENGTH = 8

type Clock = () => number

/** A connection the user started for a browser. */
export type PendingConnection = {
  code: string
  userId: string
  name: string
  expiresAt: number
}

export type ConnectionState =
  | { state: "pending"; expiresAt: Date }
  | { state: "connected"; keyId: string }
  | { state: "expired" }

// `redeeming` while the key is being created, so a second redeem of the same
// code fails even before the first one finishes.
type Progress =
  | { status: "pending" }
  | { status: "redeeming" }
  | { status: "connected"; keyId: string }

type Entry = PendingConnection & { progress: Progress }

function randomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(LENGTH))
  let code = ""
  for (const byte of bytes) code += ALPHABET[byte % ALPHABET.length]
  return code
}

/**
 * The canonical form of a code as a user may type it: upper case, no dash
 * or spaces. Null when it cannot be a code.
 */
export function normalizeInstallCode(value: string) {
  const code = value.replace(/[\s-]/g, "").toUpperCase()
  if (code.length !== LENGTH) return null
  for (const char of code) {
    if (!ALPHABET.includes(char)) return null
  }
  return code
}

/** `7KQ4XMPA` as `7KQ4-XMPA`, the way the dialog shows it. */
export function formatInstallCode(code: string) {
  return `${code.slice(0, 4)}-${code.slice(4)}`
}

function connectionOf(entry: Entry): PendingConnection {
  return {
    code: entry.code,
    userId: entry.userId,
    name: entry.name,
    expiresAt: entry.expiresAt,
  }
}

/**
 * Install codes, kept in memory: the backend runs as a single instance and a
 * restart only expires pending codes. A code is redeemed once. Entries stay
 * one more period after their expiry, so the page that started a connection
 * still learns that it connected or expired.
 */
export function createInstallCodes(now: Clock) {
  const entries = new Map<string, Entry>()

  function prune() {
    for (const [code, entry] of entries) {
      if (entry.expiresAt + INSTALL_CODE_TTL_MS <= now()) entries.delete(code)
    }
  }

  function pendingEntry(value: string) {
    const code = normalizeInstallCode(value)
    if (code === null) return null
    const entry = entries.get(code)
    if (entry?.progress.status !== "pending") return null
    if (entry.expiresAt <= now()) return null
    return entry
  }

  return {
    start(userId: string, name: string): PendingConnection {
      prune()
      let code = randomCode()
      while (entries.has(code)) code = randomCode()
      const entry: Entry = {
        code,
        userId,
        name,
        expiresAt: now() + INSTALL_CODE_TTL_MS,
        progress: { status: "pending" },
      }
      entries.set(code, entry)
      return connectionOf(entry)
    },

    /** The pending connection of a code, without spending it. */
    peek(value: string): PendingConnection | null {
      const entry = pendingEntry(value)
      if (!entry) return null
      return connectionOf(entry)
    },

    /**
     * Spends a pending code: returns its connection, or null for an unknown,
     * expired or already spent code. Follow with `complete` once the key
     * exists, or `release` when creating it failed.
     */
    redeem(value: string): PendingConnection | null {
      const entry = pendingEntry(value)
      if (!entry) return null
      entry.progress = { status: "redeeming" }
      return connectionOf(entry)
    },

    complete(code: string, keyId: string) {
      const entry = entries.get(code)
      if (entry) entry.progress = { status: "connected", keyId }
    },

    release(code: string) {
      const entry = entries.get(code)
      if (entry) entry.progress = { status: "pending" }
    },

    /** The state of the user's connection; null for another user's or an
     *  unknown code. */
    state(userId: string, value: string): ConnectionState | null {
      const code = normalizeInstallCode(value)
      if (code === null) return null
      const entry = entries.get(code)
      if (!entry || entry.userId !== userId) return null
      if (entry.progress.status === "connected") {
        return { state: "connected", keyId: entry.progress.keyId }
      }
      if (entry.expiresAt <= now()) return { state: "expired" }
      return { state: "pending", expiresAt: new Date(entry.expiresAt) }
    },
  }
}

export type InstallCodes = ReturnType<typeof createInstallCodes>

export const installCodes = createInstallCodes(Date.now)
