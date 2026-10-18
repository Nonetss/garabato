import { createHash } from "node:crypto"
import { stat } from "node:fs/promises"
import { join, resolve } from "node:path"

/** Architectures the browser token module is built for, as `uname -m`
 *  names them. */
export const MODULE_ARCHITECTURES = ["x86_64", "aarch64"] as const

export type ModuleArchitecture = (typeof MODULE_ARCHITECTURES)[number]

/** Operating systems the module and its install script exist for. */
export const MODULE_SYSTEMS = ["linux", "windows"] as const

export type ModuleSystem = (typeof MODULE_SYSTEMS)[number]

export const MODULE_FILE_NAME = "libgarabato_pkcs11.so"
export const WINDOWS_MODULE_FILE_NAME = "garabato_pkcs11.dll"

/** Where a platform's module lives under `dist/`; null for a platform the
 *  module is not built for (Windows on ARM). */
export function modulePath(os: ModuleSystem, arch: ModuleArchitecture) {
  if (os === "linux") return join(arch, MODULE_FILE_NAME)
  if (arch === "x86_64") return join("windows-x86_64", WINDOWS_MODULE_FILE_NAME)
  return null
}

const SCRIPT_FILES = {
  linux: { install: "install.sh", uninstall: "uninstall.sh" },
  windows: { install: "install.ps1", uninstall: "uninstall.ps1" },
} satisfies Record<ModuleSystem, { install: string; uninstall: string }>

export type ModuleFile = { bytes: Uint8Array<ArrayBuffer>; sha256: string }

// Values pasted into the script between single quotes: nothing that could
// close the quote or expand.
const SAFE_URL = /^https?:\/\/[^\s'"`$\\]+$/
const SAFE_CODE = /^[0-9A-Z]{8}$/

/** The install script with Garabato's address, the code and the uninstall
 *  script filled in. */
export function renderInstallScript(
  template: string,
  uninstall: string,
  url: string,
  code: string
) {
  if (!SAFE_URL.test(url)) throw new Error(`Unsafe Garabato URL: ${url}`)
  if (!SAFE_CODE.test(code)) throw new Error("Unsafe install code")
  // Replacer functions: a replacement string would expand `$'`, `$&` and
  // `$1`, which scripts are full of.
  return template
    .replace("@@URL@@", () => url)
    .replace("@@CODE@@", () => code)
    .replace("@@UNINSTALL@@", () => uninstall.trimEnd())
}

/** What an unknown, used or expired code gets: a message and nothing else.
 *  The PowerShell one never calls `exit`: it runs in the user's own console
 *  through `iex`, which `exit` would close. */
export function expiredInstallScript(os: ModuleSystem) {
  if (os === "windows") {
    return [
      "Write-Host 'Este comando ha caducado o ya se usó.' -ForegroundColor Red",
      "Write-Host 'Genera otro en Garabato → Certificados → Conectar navegador.'",
      "",
    ].join("\r\n")
  }
  return [
    "#!/bin/sh",
    "printf '%s\\n' 'Este comando ha caducado o ya se usó.' 'Genera otro en Garabato → Certificados → Conectar navegador.' >&2",
    "exit 1",
    "",
  ].join("\n")
}

/**
 * The browser token's files under `native/pkcs11`: the prebuilt modules in
 * `dist/<arch>/` and the install scripts in `install/`. A module's hash is
 * cached per file version (size and modification time), so a rebuilt module
 * is hashed again.
 */
export function createModuleFiles(nativeRoot: string) {
  const hashes = new Map<string, string>()

  async function versionOf(path: string) {
    try {
      const info = await stat(path)
      if (!info.isFile()) return null
      return `${path}:${info.size}:${info.mtimeMs}`
    } catch {
      return null
    }
  }

  async function read(
    os: ModuleSystem,
    arch: ModuleArchitecture
  ): Promise<ModuleFile | null> {
    const relative = modulePath(os, arch)
    if (relative === null) return null
    const path = join(nativeRoot, "dist", relative)
    const version = await versionOf(path)
    if (version === null) return null
    const bytes = new Uint8Array(await Bun.file(path).arrayBuffer())
    const cached = hashes.get(version)
    if (cached !== undefined) return { bytes, sha256: cached }
    const sha256 = createHash("sha256").update(bytes).digest("hex")
    hashes.set(version, sha256)
    return { bytes, sha256 }
  }

  async function installScript(os: ModuleSystem, url: string, code: string) {
    const files = SCRIPT_FILES[os]
    const [template, uninstall] = await Promise.all([
      Bun.file(join(nativeRoot, "install", files.install)).text(),
      Bun.file(join(nativeRoot, "install", files.uninstall)).text(),
    ])
    return renderInstallScript(template, uninstall, url, code)
  }

  return { read, installScript }
}

export type ModuleFiles = ReturnType<typeof createModuleFiles>

// The backend runs from `apps/backend` (the Docker image keeps the same
// layout under `/app`), as the migrations do.
export const moduleFiles = createModuleFiles(
  resolve(process.cwd(), "../../native/pkcs11")
)
