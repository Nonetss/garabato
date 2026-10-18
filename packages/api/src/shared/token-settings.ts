import { db } from "@nonete/db"
import {
  BROWSER_TOKEN_SETTINGS_ID,
  browserTokenSettings,
} from "@nonete/db/schema"

/** The browser token's emergency switches, as the procedures apply them. */
export type TokenSwitches = {
  tokenEnabled: boolean
  installsEnabled: boolean
  minModuleVersion: string | null
}

/** What a module reports about itself in `x-garabato-module`. */
export type ModuleIdentity = { version: string; platform: string }

/** The header a module sends: `<version> <os>-<arch>`. */
export const MODULE_HEADER = "x-garabato-module"

/** Modules installed before they reported a version. */
export const LEGACY_MODULE_VERSION = "0.1.0"

const VERSION = /^\d+\.\d+\.\d+$/
const PLATFORM = /^[a-z0-9_]+-[a-z0-9_]+$/

const DEFAULT_SWITCHES: TokenSwitches = {
  tokenEnabled: true,
  installsEnabled: true,
  minModuleVersion: null,
}

/** Whether a value is a `major.minor.patch` version. */
export function isModuleVersion(value: string) {
  return VERSION.test(value)
}

function parts(version: string) {
  return version.split(".").map((part) => Number.parseInt(part, 10))
}

/** Negative, zero or positive as `a` is older than, equal to or newer than `b`. */
export function compareVersions(a: string, b: string) {
  const left = parts(a)
  const right = parts(b)
  for (let index = 0; index < 3; index++) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0)
    if (difference !== 0) return difference
  }
  return 0
}

/** Whether a module version is below the minimum (none: never). */
export function isOutdated(version: string, minimum: string | null) {
  if (minimum === null) return false
  return compareVersions(version, minimum) < 0
}

/**
 * The module identity in a request. A missing or malformed header counts as
 * the legacy version: modules before 0.2.0 sent none.
 */
export function moduleIdentityOf(headers: Headers): ModuleIdentity {
  const [version, platform] = (headers.get(MODULE_HEADER) ?? "")
    .trim()
    .split(/\s+/)
  if (!version || !isModuleVersion(version)) {
    return { version: LEGACY_MODULE_VERSION, platform: "unknown" }
  }
  if (!platform || !PLATFORM.test(platform)) {
    return { version, platform: "unknown" }
  }
  return { version, platform }
}

/** The settings row, or null when none was ever saved. */
export async function readSettingsRow() {
  const row = await db.query.browserTokenSettings.findFirst({
    where: { id: BROWSER_TOKEN_SETTINGS_ID },
    with: { updatedByUser: true },
  })
  return row ?? null
}

/** The switches in force: the saved ones, or everything enabled. */
export async function readSwitches(): Promise<TokenSwitches> {
  const row = await readSettingsRow()
  if (!row) return DEFAULT_SWITCHES
  return {
    tokenEnabled: row.tokenEnabled,
    installsEnabled: row.installsEnabled,
    minModuleVersion: row.minModuleVersion,
  }
}

/** Saves the switches as the only settings row. */
export async function writeSwitches(switches: TokenSwitches, userId: string) {
  const values = { ...switches, updatedAt: new Date(), updatedBy: userId }
  await db
    .insert(browserTokenSettings)
    .values({ id: BROWSER_TOKEN_SETTINGS_ID, ...values })
    .onConflictDoUpdate({ target: browserTokenSettings.id, set: values })
}
