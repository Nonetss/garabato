/** How long a TOTP code keeps a token key's signing window open. */
export const SIGNING_WINDOW_MS = 15 * 60 * 1000
/** Wrong codes a user may send before unlocking is refused for a while. */
export const UNLOCK_FAILURE_LIMIT = 5
/** How long unlocking stays refused after the last allowed wrong code. */
export const UNLOCK_LOCKOUT_MS = 15 * 60 * 1000

type Clock = () => number

/**
 * The browser token's state, kept in memory: each token key's signing
 * window, the last TOTP step each user spent (no code unlocks twice) and the
 * wrong codes that lead to a lockout. The backend runs as a single instance;
 * a restart closes every window, so the browser asks for a code again.
 */
export function createTokenWindows(now: Clock) {
  const windows = new Map<string, number>()
  const lastSteps = new Map<string, number>()
  const failures = new Map<string, number[]>()
  const lockouts = new Map<string, number>()

  function recentFailures(userId: string) {
    const since = now() - UNLOCK_LOCKOUT_MS
    const recent = (failures.get(userId) ?? []).filter((at) => at > since)
    failures.set(userId, recent)
    return recent
  }

  return {
    /** Opens or extends the key's window; returns when it closes. */
    open(keyId: string) {
      const expiresAt = now() + SIGNING_WINDOW_MS
      windows.set(keyId, expiresAt)
      return new Date(expiresAt)
    },

    close(keyId: string) {
      windows.delete(keyId)
    },

    isOpen(keyId: string) {
      const expiresAt = windows.get(keyId)
      if (expiresAt === undefined) return false
      if (expiresAt > now()) return true
      windows.delete(keyId)
      return false
    },

    /**
     * Spends a TOTP time step for the user; false when that step or a later
     * one already unlocked a window.
     */
    spendStep(userId: string, step: number) {
      const last = lastSteps.get(userId)
      if (last !== undefined && step <= last) return false
      lastSteps.set(userId, step)
      return true
    },

    /** When unlocking is allowed again, or null when it is allowed now. */
    lockedUntil(userId: string) {
      const until = lockouts.get(userId)
      if (until === undefined) return null
      if (until > now()) return new Date(until)
      lockouts.delete(userId)
      return null
    },

    /** Counts a wrong code; the fifth within the period starts a lockout. */
    recordFailure(userId: string) {
      const recent = recentFailures(userId)
      recent.push(now())
      if (recent.length < UNLOCK_FAILURE_LIMIT) return
      lockouts.set(userId, now() + UNLOCK_LOCKOUT_MS)
      failures.delete(userId)
    },

    clearFailures(userId: string) {
      failures.delete(userId)
    },
  }
}

export type TokenWindows = ReturnType<typeof createTokenWindows>

export const tokenWindows = createTokenWindows(Date.now)
