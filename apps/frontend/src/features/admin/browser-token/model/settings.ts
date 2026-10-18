/** Connected browsers of every user on one module version and platform. */
export type BrowserGroup = {
  version: string
  platform: string
  count: number
  outdated: boolean
}

/** The browser token's emergency switches, as the admin page shows them. */
export type BrowserTokenSettings = {
  tokenEnabled: boolean
  installsEnabled: boolean
  minModuleVersion: string | null
  servedVersion: string
  updatedAt: string | null
  updatedBy: { id: string; name: string } | null
  browsers: BrowserGroup[]
}

export type SwitchValues = Pick<
  BrowserTokenSettings,
  "tokenEnabled" | "installsEnabled" | "minModuleVersion"
>

const VERSION = /^\d+\.\d+\.\d+$/

/** Whether a value is a `major.minor.patch` version. */
export function isModuleVersion(value: string) {
  return VERSION.test(value)
}

/** Negative, zero or positive as `a` is older than, equal to or newer than `b`. */
export function compareVersions(a: string, b: string) {
  const left = a.split(".").map(Number)
  const right = b.split(".").map(Number)
  for (let index = 0; index < 3; index++) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0)
    if (difference !== 0) return difference
  }
  return 0
}

export function connectedBrowsers(groups: BrowserGroup[]) {
  return groups.reduce((total, group) => total + group.count, 0)
}

/** Browsers that a minimum version would leave out. */
export function browsersBelow(groups: BrowserGroup[], minimum: string | null) {
  if (minimum === null) return 0
  return groups
    .filter((group) => compareVersions(group.version, minimum) < 0)
    .reduce((total, group) => total + group.count, 0)
}

function browsersLabel(count: number) {
  if (count === 1) return "1 navegador conectado"
  return `${count} navegadores conectados`
}

export type Confirmation = {
  title: string
  description: string
  confirmLabel: string
}

/**
 * What to ask before a change that cuts browsers off, or null when the
 * change only restores or relaxes something.
 */
export function confirmationFor(
  current: SwitchValues,
  next: SwitchValues,
  groups: BrowserGroup[]
): Confirmation | null {
  if (current.tokenEnabled && !next.tokenEnabled) {
    return {
      title: "Desactivar el token del navegador",
      description: `${browsersLabel(connectedBrowsers(groups))} dejarán de poder entrar con certificado y nadie podrá conectar navegadores nuevos hasta que lo vuelvas a activar.`,
      confirmLabel: "Desactivar el token",
    }
  }
  if (current.installsEnabled && !next.installsEnabled) {
    return {
      title: "Desactivar las instalaciones",
      description:
        "Nadie podrá conectar navegadores nuevos. Los que ya están conectados seguirán funcionando.",
      confirmLabel: "Desactivar las instalaciones",
    }
  }
  const before = browsersBelow(groups, current.minModuleVersion)
  const after = browsersBelow(groups, next.minModuleVersion)
  if (next.minModuleVersion !== null && after > before) {
    return {
      title: `Exigir el módulo ${next.minModuleVersion}`,
      description: `${browsersLabel(after)} dejarán de funcionar hasta que sus usuarios los vuelvan a conectar desde Certificados.`,
      confirmLabel: "Exigir la versión",
    }
  }
  return null
}
