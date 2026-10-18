import { versionNumberLabel } from "@/features/documents/shared/public"
import {
  deletedAware,
  placementLabel,
} from "@/features/traces/overview/model/filters"
import type {
  TraceFolderRef,
  TrailEntry,
  TrailType,
} from "@/features/traces/overview/model/types"
import { getDateBucketLabel, joinFacts } from "@/lib/format"

/** The Spanish name of each entry type. */
export const TRAIL_TYPE_LABELS: Record<TrailType, string> = {
  "document.signed": "Documento firmado",
  "document.uploaded": "Documento subido",
  "document.merged": "Documentos unidos",
  "document.pagesEdited": "Páginas editadas",
  "document.downloaded": "Documento descargado",
  "document.renamed": "Documento renombrado",
  "document.moved": "Documento movido",
  "document.versionDeleted": "Versión eliminada",
  "document.deleted": "Documento eliminado",
  "certificate.imported": "Certificado importado",
  "certificate.usedToSignIn": "Acceso con certificado",
  "certificate.renamed": "Certificado renombrado",
  "certificate.passwordRemembered": "Contraseña recordada",
  "certificate.passwordForgotten": "Contraseña olvidada",
  "certificate.deleted": "Certificado eliminado",
  "browser.connected": "Navegador conectado",
  "browser.disconnected": "Navegador desconectado",
  "browser.unlocked": "Navegador desbloqueado",
  "browser.unlockFailed": "Código incorrecto en el navegador",
  "browser.locked": "Navegador bloqueado",
  "browser.installRefused": "Comando de instalación rechazado",
  "account.signedIn": "Inicio de sesión",
  "account.signInFailed": "Inicio de sesión fallido",
  "account.signedOut": "Cierre de sesión",
  "account.nameChanged": "Nombre cambiado",
  "account.passwordChanged": "Contraseña cambiada",
  "account.twoFactorEnabled": "Verificación en dos pasos activada",
  "account.twoFactorDisabled": "Verificación en dos pasos desactivada",
  "account.twoFactorFailed": "Código de verificación incorrecto",
}

/** The browser (connected token key) an entry concerns, as then named. */
export function traceBrowserName(entry: TrailEntry) {
  switch (entry.type) {
    case "certificate.usedToSignIn":
    case "browser.connected":
    case "browser.disconnected":
    case "browser.unlocked":
    case "browser.unlockFailed":
    case "browser.locked":
      return entry.details.key.name
    case "browser.installRefused":
      return entry.details.name
    default:
      return null
  }
}

/** Why a refused browser or account action failed, in Spanish. */
export function traceFailureReason(entry: TrailEntry) {
  switch (entry.type) {
    case "browser.unlockFailed":
      if (entry.details.reason === "locked-out") return "demasiados intentos"
      return "código incorrecto"
    case "browser.installRefused":
      if (entry.details.reason === "used") return "comando ya usado"
      return "comando caducado"
    case "account.signInFailed":
      if (entry.details.reason === "banned") return "cuenta bloqueada"
      return "contraseña incorrecta"
    default:
      return null
  }
}

/** How a sign-in happened, for the detail. */
export function signInMethodLabel(method: "password" | "sso") {
  if (method === "sso") return "Inicio de sesión único (SSO)"
  return "Contraseña"
}

/** A folder by name; "Biblioteca" for the library root. */
export function folderLabel(folder: TraceFolderRef) {
  if (folder === null) return "Biblioteca"
  return folder.name
}

/** What the entry is about: the document, the certificate, or both. */
export function traceSubject(entry: TrailEntry) {
  const names: string[] = []
  if (entry.document) {
    names.push(deletedAware(entry.document.name, entry.document.deleted))
  }
  if (entry.certificate) {
    names.push(deletedAware(entry.certificate.alias, entry.certificate.deleted))
  }
  // A sign-in with a certificate already names the certificate.
  const browser = traceBrowserName(entry)
  if (browser !== null && entry.type !== "certificate.usedToSignIn") {
    names.push(browser)
  }
  if (names.length === 0 && entry.type.startsWith("account.")) {
    return "Tu cuenta"
  }
  return joinFacts(names)
}

// `3`, or `3 (eliminada)` once the version has been deleted.
function versionNumber(entry: TrailEntry) {
  if (entry.version === null) return "?"
  if (entry.version.deleted) return `${entry.version.number} (eliminada)`
  return String(entry.version.number)
}

/** The entry's version as the detail shows it: `v3`, `v3 (eliminada)`. */
export function traceVersionLabel(entry: TrailEntry) {
  if (entry.version === null) return ""
  return versionNumberLabel(entry.version.number, entry.version.deleted)
}

// "a.pdf, b.pdf y c.pdf"; past three names, "a.pdf, b.pdf y 3 más".
function namesList(names: string[]) {
  if (names.length <= 3) {
    const last = names.at(-1)
    if (names.length < 2 || last === undefined) return names.join("")
    return `${names.slice(0, -1).join(", ")} y ${last}`
  }
  return `${names.slice(0, 2).join(", ")} y ${names.length - 2} más`
}

function certificateAlias(entry: TrailEntry) {
  if (entry.certificate === null) return "un certificado"
  return `«${entry.certificate.alias}»`
}

/** One sentence on what happened, for the timeline. */
export function traceDescription(entry: TrailEntry) {
  switch (entry.type) {
    case "document.signed":
      return joinFacts([
        `Firmado con ${certificateAlias(entry)}`,
        versionNumberLabel(
          entry.signature.versionNumber,
          entry.signature.versionDeleted
        ),
        placementLabel(entry.signature),
      ])
    case "document.uploaded":
      return "Subido como versión 1"
    case "document.merged":
      return `Unión de ${namesList(entry.details.sources.map((source) => source.name))}`
    case "document.pagesEdited":
      return `Páginas reordenadas, giradas o quitadas en la versión ${versionNumber(entry)}`
    case "document.downloaded":
      return `Descargada la versión ${versionNumber(entry)}`
    case "document.renamed":
    case "certificate.renamed":
      return `${entry.details.from} → ${entry.details.to}`
    case "document.moved":
      return `${folderLabel(entry.details.from)} → ${folderLabel(entry.details.to)}`
    case "document.versionDeleted":
      return `Se eliminó la versión ${entry.version?.number ?? "?"}; la anterior vuelve a ser la actual`
    case "document.deleted":
      return "Borrado junto con sus versiones; sus firmas siguen registradas"
    case "certificate.imported":
      return entry.certificate?.holder ?? ""
    case "certificate.usedToSignIn":
      return `«${entry.details.key.name}» lo usó para identificarte en un sitio web`
    case "browser.connected":
      return `«${entry.details.key.name}» se conectó desde ${entry.details.platform}`
    case "browser.disconnected":
      return `Se desconectó «${entry.details.key.name}»; su clave dejó de valer`
    case "browser.unlocked":
      return `«${entry.details.key.name}» se desbloqueó con un código válido`
    case "browser.unlockFailed":
      if (entry.details.reason === "locked-out") {
        return `«${entry.details.key.name}» rechazado por demasiados códigos incorrectos`
      }
      return `Código incorrecto en «${entry.details.key.name}»`
    case "browser.locked":
      return `«${entry.details.key.name}» se bloqueó`
    case "browser.installRefused":
      if (entry.details.reason === "used") {
        return `Alguien ejecutó el comando de «${entry.details.name}», que ya se había usado`
      }
      return `Alguien ejecutó el comando de «${entry.details.name}», que había caducado`
    case "account.signedIn":
      return signInMethodLabel(entry.details.method)
    case "account.signInFailed":
      if (entry.details.reason === "banned") {
        return "Se intentó entrar en una cuenta bloqueada"
      }
      return "Se intentó entrar con una contraseña incorrecta"
    case "account.signedOut":
      return "Se cerró la sesión"
    case "account.nameChanged":
      return `${entry.details.from} → ${entry.details.to}`
    case "account.passwordChanged":
      return "Se cambió la contraseña"
    case "account.twoFactorEnabled":
      return "Se activó la verificación en dos pasos"
    case "account.twoFactorDisabled":
      return "Se desactivó la verificación en dos pasos"
    case "account.twoFactorFailed":
      return "Se escribió un código de verificación incorrecto al entrar"
    case "certificate.passwordRemembered":
      return "La contraseña queda guardada cifrada para firmar sin escribirla"
    case "certificate.passwordForgotten":
      return "Se borró la contraseña guardada"
    case "certificate.deleted":
      return "Se borraron el archivo y la contraseña; sus firmas siguen registradas"
  }
}

/** How strongly the timeline marks the entry: signatures stand out,
 *  deletions read as destructive. */
export function traceTone(
  type: TrailType
): "primary" | "destructive" | "muted" {
  if (type === "document.signed") return "primary"
  if (
    type === "document.deleted" ||
    type === "document.versionDeleted" ||
    type === "certificate.deleted" ||
    type === "browser.disconnected" ||
    type === "browser.unlockFailed" ||
    type === "browser.installRefused" ||
    type === "account.signInFailed" ||
    type === "account.twoFactorFailed"
  ) {
    return "destructive"
  }
  return "muted"
}

export type TraceGroup = { label: string; entries: TrailEntry[] }

/** Splits the trail (newest first) into recency groups: "Hoy", "Esta
 *  semana", "Este mes"… */
export function groupByRecency(entries: TrailEntry[]): TraceGroup[] {
  const groups: TraceGroup[] = []
  for (const entry of entries) {
    const label = getDateBucketLabel(entry.occurredAt)
    const last = groups.at(-1)
    if (last?.label === label) last.entries.push(entry)
    else groups.push({ label, entries: [entry] })
  }
  return groups
}
