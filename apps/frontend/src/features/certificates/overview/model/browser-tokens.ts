/** A browser connected to Garabato: its token key, never the key value. */
export type ConnectedBrowser = {
  id: string
  name: string
  createdAt: string
  expiresAt: string | null
  /** Last time its module reached Garabato; null when never used. */
  lastUsedAt: string | null
  /** The module version it last reported ("0.1.0" for modules that never did). */
  moduleVersion: string
  platform: string
  /** Below the minimum module version an administrator set. */
  outdated: boolean
}

const SYSTEM_NAMES = new Map([
  ["linux", "Linux"],
  ["windows", "Windows"],
])

/** The module's platform as people read it ("linux-x86_64" → "Linux
 *  x86_64"); null for browsers connected before modules reported one. */
export function platformLabel(platform: string) {
  if (platform === "unknown") return null
  const [system = "", ...arch] = platform.split("-")
  const name = SYSTEM_NAMES.get(system)
  if (!name) return platform
  return [name, ...arch].join(" ")
}

/** The emergency switches as the certificates page needs them. */
export type TokenSwitches = {
  tokenEnabled: boolean
  installsEnabled: boolean
  minModuleVersion: string | null
  servedVersion: string
}

/** Whether new browsers may be connected; true until the switches load,
 *  since the backend refuses anyway. */
export function installsAllowed(switches: TokenSwitches | undefined) {
  if (!switches) return true
  return switches.tokenEnabled && switches.installsEnabled
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
