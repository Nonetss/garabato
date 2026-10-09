import {
  deletedAware,
  placementLabel,
} from "@/features/traces/overview/model/filters"
import type {
  TraceFolderRef,
  TrailEntry,
  TrailType,
} from "@/features/traces/overview/model/types"

/** The Spanish name of each entry type. */
export const TRAIL_TYPE_LABELS: Record<TrailType, string> = {
  "document.signed": "Documento firmado",
  "document.uploaded": "Documento subido",
  "document.merged": "Documentos unidos",
  "document.pagesEdited": "Páginas editadas",
  "document.downloaded": "Documento descargado",
  "document.renamed": "Documento renombrado",
  "document.moved": "Documento movido",
  "document.deleted": "Documento eliminado",
  "certificate.imported": "Certificado importado",
  "certificate.renamed": "Certificado renombrado",
  "certificate.passwordRemembered": "Contraseña recordada",
  "certificate.passwordForgotten": "Contraseña olvidada",
  "certificate.deleted": "Certificado eliminado",
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
  return names.join(" · ")
}

function versionLabel(entry: TrailEntry) {
  if (entry.version === null) return ""
  return `v${entry.version.number}`
}

function documentCount(count: number) {
  if (count === 1) return "1 documento"
  return `${count} documentos`
}

/** One line on what the entry changed: names, folders, version, placement. */
export function traceSummary(entry: TrailEntry) {
  switch (entry.type) {
    case "certificate.renamed":
    case "document.renamed":
      return `${entry.details.from} → ${entry.details.to}`
    case "document.moved":
      return `${folderLabel(entry.details.from)} → ${folderLabel(entry.details.to)}`
    case "document.merged":
      return documentCount(entry.details.sources.length)
    case "document.signed":
      return `v${entry.signature.versionNumber} · ${placementLabel(entry.signature)}`
    default:
      return versionLabel(entry)
  }
}
