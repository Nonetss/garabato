/** A browser connected to Garabato: its token key, never the key value. */
export type ConnectedBrowser = {
  id: string
  name: string
  createdAt: string
  expiresAt: string | null
  /** Last time its module reached Garabato; null when never used. */
  lastUsedAt: string | null
}

/** Operating systems the module has an install command for. */
export type InstallSystem = "linux" | "windows"

/** A connection waiting for its install command to run. */
export type StartedConnection = {
  code: string
  displayCode: string
  commands: Record<InstallSystem, string>
  expiresAt: string
}

/** The system whose command to show first: Windows when the page runs on
 *  Windows, Linux otherwise. */
export function detectInstallSystem(userAgent: string): InstallSystem {
  if (/Windows/i.test(userAgent)) return "windows"
  return "linux"
}

export type ConnectionStatus =
  | { state: "pending"; expiresAt: string }
  | { state: "connected"; keyId: string }
  | { state: "expired" }

/** Time left until `expiresAt`, as `m:ss`; `0:00` once it has passed. */
export function remainingLabel(expiresAt: string, now: number) {
  const seconds = Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1000))
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`
}
